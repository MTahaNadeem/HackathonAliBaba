package com.dustzero.app.iot

import com.dustzero.app.BuildConfig
import com.dustzero.app.data.AlertEntity
import com.dustzero.app.data.AppDao
import com.dustzero.app.models.AppConstants
import com.dustzero.app.models.SensorData
import com.dustzero.app.models.ThresholdConfig
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeRecordOrNull
import io.github.jan.supabase.realtime.postgresChangeFlow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Supabase-backed IoT service.
 *
 * Data flow (inbound — sensor readings):
 *   ESP32-S3 → Wi-Fi → Supabase `devices` table → Realtime subscription → SensorData StateFlow → ViewModel → UI
 *
 * Data flow (outbound — commands):
 *   UI → ViewModel → SupabaseIotService → INSERT into `commands` table → ESP32-S3 polls → executes
 *
 * Online/offline detection:
 *   Device is ONLINE only if: devices.connected == true AND devices.updated_at
 *   was updated within HEARTBEAT_TIMEOUT_MS (30s). The ESP32 firmware must update
 *   `updated_at` on every sensor write; if it crashes without clearing `connected`,
 *   the heartbeat window will catch it within 30s.
 *
 * Alert generation:
 *   There is NO `alerts` table in the current Supabase schema. Alerts are generated
 *   client-side by watching state changes in the Realtime subscription and inserting
 *   into the local Room database. This can be replaced with a real Supabase alerts
 *   table in a future schema migration — see generateAlertsForStateChange().
 *
 * Analytics:
 *   There is NO `device_history` table in the current schema. Analytics charts use
 *   mock/static data. A future `device_history` table can be plugged in by adding
 *   a HistoryService that queries that table — no changes needed to this file.
 *
 * Fallback:
 *   If SUPABASE_URL / SUPABASE_KEY are placeholder values (unconfigured), the service
 *   automatically activates DemoIotService as a fallback.
 */
class SupabaseIotService(
    private val fallbackDemoService: IotService,
    private val dao: AppDao
) : IotService {

    private val scope = CoroutineScope(Dispatchers.IO)

    private val _sensorData = MutableStateFlow(SensorData())
    override val sensorData: StateFlow<SensorData> = _sensorData.asStateFlow()

    private val _demoModeEnabled = MutableStateFlow(false)
    override val demoModeEnabled: StateFlow<Boolean> = _demoModeEnabled.asStateFlow()

    override val config: StateFlow<ThresholdConfig> = fallbackDemoService.config

    private val supabaseUrl = BuildConfig.SUPABASE_URL
    private val supabaseKey = BuildConfig.SUPABASE_KEY

    private val isConfigured = supabaseUrl.isNotBlank()
            && supabaseKey.isNotBlank()
            && supabaseUrl != "null"
            && supabaseUrl != "https://xyzcompany.supabase.co"

    private val supabase by lazy {
        createSupabaseClient(
            supabaseUrl = supabaseUrl,
            supabaseKey = supabaseKey
        ) {
            install(Postgrest)
            install(Realtime)
        }
    }

    init {
        if (isConfigured) {
            startRealtimeSubscription()
        } else {
            // Supabase not configured → fall back to Demo Mode automatically
            setDemoMode(true)
        }

        // Mirror demo service data into _sensorData whenever demo mode is active
        scope.launch {
            fallbackDemoService.sensorData.collect { demoData ->
                if (_demoModeEnabled.value) {
                    _sensorData.value = demoData
                }
            }
        }
    }

    // ─── Realtime Subscription ────────────────────────────────────────────────

    private fun startRealtimeSubscription() {
        scope.launch {
            try {
                // 1. Initial fetch — populate UI before the first Realtime event fires
                fetchAndApplyDevice()

                // 2. Subscribe to UPDATE events on the devices table.
                // Note: supabase-kt 3.x PostgresChangeFilter does not expose a public
                // `filter` property for row-level filtering. We use a device-scoped
                // channel name and filter by device_id in fetchAndApplyDevice()'s SELECT.
                val channel = supabase.channel("devices:${AppConstants.DEVICE_ID}")
                val changes = channel.postgresChangeFlow<PostgresAction.Update>(schema = "public") {
                    table = AppConstants.TABLE_DEVICES
                }

                channel.subscribe()

                // 3. On every Realtime update event, decode the payload directly to avoid an extra network round-trip
                changes.collect { action ->
                    if (!_demoModeEnabled.value) {
                        try {
                            val dto = action.decodeRecordOrNull<DeviceDTO>()
                            if (dto != null) {
                                val previousData = _sensorData.value
                                val newData = dtoToSensorData(dto)
                                _sensorData.value = newData
                                generateAlertsForStateChange(previousData, newData)
                            } else {
                                // Fallback if partial update or decode fails
                                fetchAndApplyDevice()
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            fetchAndApplyDevice()
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                if (!_demoModeEnabled.value) {
                    // Surface an offline state so the UI shows "Device Offline"
                    _sensorData.update { it.copy(connected = false, isOnline = false) }
                    // Store a local alert for the connection loss
                    dao.insertAlert(
                        AlertEntity(
                            type = "Connection",
                            severity = "CRITICAL",
                            message = "CLOUD CONNECTION LOST - Unable to reach Supabase. Check internet connectivity."
                        )
                    )
                }
            }
        }
    }

    /**
     * Fetches the current `devices` row for our device_id and applies it to
     * [_sensorData], computing [SensorData.isOnline] from the heartbeat.
     */
    private suspend fun fetchAndApplyDevice() {
        try {
            val dto = supabase.from(AppConstants.TABLE_DEVICES)
                .select { filter { eq("device_id", AppConstants.DEVICE_ID) } }
                .decodeSingleOrNull<DeviceDTO>()

            if (dto != null) {
                val previousData = _sensorData.value
                val newData = dtoToSensorData(dto)
                _sensorData.value = newData
                // Generate local alerts for any state changes (rain, fault, offline, cycle complete)
                generateAlertsForStateChange(previousData, newData)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Converts a [DeviceDTO] from Supabase into a [SensorData] domain model.
     *
     * Online detection: combines `connected` column with heartbeat freshness.
     * If updated_at is null (device record was just created), fall back to `connected` alone.
     */
    private fun dtoToSensorData(dto: DeviceDTO): SensorData {
        val updatedAtMs = parseIso8601ToMs(dto.updatedAt)
        val heartbeatFresh = updatedAtMs > 0L &&
                (System.currentTimeMillis() - updatedAtMs) < AppConstants.HEARTBEAT_TIMEOUT_MS
        val isOnline = dto.connected && heartbeatFresh

        return SensorData(
            deviceId = dto.deviceId,
            connected = dto.connected,
            ldr1 = dto.ldr1,
            ldr2 = dto.ldr2,
            temperature = dto.temperature,
            solarVoltage = dto.solarVoltage,
            solarCurrent = dto.solarCurrent,
            solarPower = dto.solarPower,
            rainDetected = dto.rainDetected,
            sunDetected = dto.sunDetected,
            sunlightLevel = dto.sunlightLevel,
            cleaningState = dto.cleaningState,
            cleaningProgress = dto.cleaningProgress,
            cleaningSteps = dto.cleaningSteps,
            fault = dto.fault,
            updatedAtMs = updatedAtMs,
            isOnline = isOnline
        )
    }

    // ─── Client-Side Alert Generation ─────────────────────────────────────────
    //
    // NOTE: There is NO `alerts` table in the current Supabase schema.
    // This function watches for meaningful state transitions in the Realtime
    // feed and inserts alerts into the local Room database.
    //
    // FUTURE: When a `device_alerts` table is added to the schema, replace this
    // function with a Realtime subscription on that table and remove local inserts.

    private fun generateAlertsForStateChange(prev: SensorData, next: SensorData) {
        scope.launch {
            // Rain detected (transition: false → true)
            if (!prev.rainDetected && next.rainDetected) {
                dao.insertAlert(AlertEntity(
                    type = "Safety",
                    severity = "WARNING",
                    message = "RAIN DETECTED - Automatic cleaning is temporarily blocked for panel protection."
                ))
            }
            // Rain cleared (transition: true → false)
            if (prev.rainDetected && !next.rainDetected) {
                dao.insertAlert(AlertEntity(
                    type = "Safety",
                    severity = "INFO",
                    message = "RAIN CLEARED - Cleaning operations can resume."
                ))
            }
            // Fault asserted (false → true)
            if (!prev.fault && next.fault) {
                dao.insertAlert(AlertEntity(
                    type = "Fault",
                    severity = "CRITICAL",
                    message = "SYSTEM FAULT - The ESP32 has reported a hardware fault. Manual inspection required."
                ))
            }
            // Device went offline
            if (prev.isOnline && !next.isOnline) {
                dao.insertAlert(AlertEntity(
                    type = "Connection",
                    severity = "CRITICAL",
                    message = "DEVICE OFFLINE - ESP32 stopped sending heartbeats. Check Wi-Fi and power."
                ))
            }
            // Device came back online
            if (!prev.isOnline && next.isOnline) {
                dao.insertAlert(AlertEntity(
                    type = "Connection",
                    severity = "INFO",
                    message = "DEVICE ONLINE - ESP32 reconnected to cloud."
                ))
            }
            // Cleaning cycle completed (MOVING_UP → IDLE)
            if (prev.cleaningState == AppConstants.STATE_MOVING_UP
                && next.cleaningState == AppConstants.STATE_IDLE) {
                dao.insertAlert(AlertEntity(
                    type = "Cleaning",
                    severity = "INFO",
                    message = "CLEANING COMPLETED - Cleaning cycle completed successfully."
                ))
            }
        }
    }

    // ─── Command Service ──────────────────────────────────────────────────────

    override suspend fun startCleaning() {
        if (_demoModeEnabled.value || !isConfigured) {
            fallbackDemoService.startCleaning()
        } else {
            sendCommand(AppConstants.CMD_START_CLEANING)
        }
    }

    override suspend fun stopCleaning() {
        if (_demoModeEnabled.value || !isConfigured) {
            fallbackDemoService.stopCleaning()
        } else {
            sendCommand(AppConstants.CMD_STOP_CLEANING)
        }
    }

    override suspend fun homeMotor() {
        if (_demoModeEnabled.value || !isConfigured) {
            fallbackDemoService.homeMotor()
        } else {
            sendCommand(AppConstants.CMD_HOME_MOTOR)
        }
    }

    /**
     * Inserts a command row into the `commands` table with status = PENDING.
     * The ESP32 firmware polls this table, executes the command, and updates
     * status to ACKNOWLEDGED / COMPLETED / FAILED.
     */
    private suspend fun sendCommand(command: String) {
        try {
            val cmd = CommandDTO(
                deviceId = AppConstants.DEVICE_ID,
                command = command,
                status = "PENDING"
            )
            supabase.from(AppConstants.TABLE_COMMANDS).insert(cmd)
        } catch (e: Exception) {
            e.printStackTrace()
            // Surface a local alert so the user knows the command failed
            dao.insertAlert(AlertEntity(
                type = "Command",
                severity = "WARNING",
                message = "COMMAND FAILED - Could not send '$command' to device. Check connectivity."
            ))
        }
    }

    // ─── Demo Mode ────────────────────────────────────────────────────────────

    override fun setDemoMode(enabled: Boolean) {
        _demoModeEnabled.value = enabled
        fallbackDemoService.setDemoMode(enabled)
        if (!enabled && isConfigured) {
            // Re-fetch real data immediately when exiting demo mode
            scope.launch { fetchAndApplyDevice() }
        } else if (!enabled && !isConfigured) {
            // Cannot exit demo mode — Supabase is not configured
            _sensorData.update { it.copy(connected = false, isOnline = false) }
        }
    }

    override fun updateConfig(newConfig: ThresholdConfig) {
        fallbackDemoService.updateConfig(newConfig)
    }

    override fun setDemoScenario(scenario: String) {
        fallbackDemoService.setDemoScenario(scenario)
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Parses an ISO-8601 UTC timestamp string (e.g. "2026-09-11T14:30:00+00:00")
     * returned by Supabase into epoch milliseconds for heartbeat comparison.
     * Returns 0L if the string is null or cannot be parsed.
     */
    private fun parseIso8601ToMs(iso: String?): Long {
        if (iso == null) return 0L
        return try {
            // Try the format Supabase returns for timestamptz: "2026-09-11T14:30:00+00:00"
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ssXXX",
                "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXX",
                "yyyy-MM-dd'T'HH:mm:ss'Z'"
            )
            for (fmt in formats) {
                try {
                    val sdf = SimpleDateFormat(fmt, Locale.US).apply {
                        timeZone = TimeZone.getTimeZone("UTC")
                    }
                    return sdf.parse(iso)?.time ?: continue
                } catch (_: Exception) { continue }
            }
            0L
        } catch (e: Exception) {
            0L
        }
    }

    override suspend fun getDeviceHistory(rangeHours: Int): List<DeviceHistoryDTO> {
        if (_demoModeEnabled.value || !isConfigured) return fallbackDemoService.getDeviceHistory(rangeHours)
        
        return try {
            // Get history from the last `rangeHours` hours, ordered by recorded_at ascending
            val now = System.currentTimeMillis()
            val cutoff = now - (rangeHours * 60 * 60 * 1000L)
            val isoCutoff = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(cutoff)

            supabase.from("device_history")
                .select { 
                    filter { 
                        eq("device_id", AppConstants.DEVICE_ID)
                        gte("recorded_at", isoCutoff)
                    }
                    order("recorded_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
                }
                .decodeList<DeviceHistoryDTO>()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    override suspend fun refreshConnection(): Boolean {
        if (_demoModeEnabled.value || !isConfigured) return fallbackDemoService.refreshConnection()
        
        return try {
            fetchAndApplyDevice()
            _sensorData.value.isOnline
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
