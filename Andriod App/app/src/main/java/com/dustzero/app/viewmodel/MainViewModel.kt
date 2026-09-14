package com.dustzero.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.dustzero.app.data.AppDao
import com.dustzero.app.data.ThemeMode
import com.dustzero.app.data.ThemePreferences
import com.dustzero.app.iot.IotService
import com.dustzero.app.models.AppConstants
import com.dustzero.app.models.ThresholdConfig
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import com.dustzero.app.iot.DeviceHistoryDTO

class MainViewModel(
    private val iotService: IotService,
    private val dao: AppDao,
    private val themePreferences: ThemePreferences
) : ViewModel() {

    val themeMode = themePreferences.themeMode

    fun setThemeMode(mode: ThemeMode) {
        themePreferences.setThemeMode(mode)
    }

    val sensorData = iotService.sensorData
    val demoModeEnabled = iotService.demoModeEnabled
    val config = iotService.config

    // ─── Derived device state ─────────────────────────────────────────────────

    /**
     * True when the device is genuinely reachable: connected==true AND
     * updated_at heartbeat is fresh (within HEARTBEAT_TIMEOUT_MS).
     * Prefer this over sensorData.connected for UI online/offline decisions.
     */
    val isDeviceOnline = sensorData.map { it.isOnline }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    /**
     * True when devices.fault == true. Surface this as a red banner on Dashboard
     * and as an entry in the alerts list.
     */
    val hasFault = sensorData.map { it.fault }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), false)

    /**
     * Panel status string derived from live sensor data.
     * Drives the hero status card on Dashboard.
     */
    val panelStatus = sensorData.map { data ->
        when {
            data.fault -> "FAULT"
            !data.isOnline -> "OFFLINE"
            data.rainDetected -> "RAIN DETECTED"
            AppConstants.isActivelyCleaning(data.cleaningState) -> "CLEANING"
            !data.sunDetected -> "LOW SUNLIGHT"
            data.solarPower < (config.value.expectedPowerClean *
                    (1.0 - config.value.powerDropTriggerPercent / 100.0)) -> "POSSIBLE DUST"
            else -> "OPTIMAL"
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), "OPTIMAL")

    // ─── Alerts (local Room DB) ────────────────────────────────────────────────
    // NOTE: There is no `alerts` table in Supabase. Alerts are generated
    // client-side by SupabaseIotService watching state changes, and stored locally.

    val alerts = dao.getAllAlerts()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val cleaningHistory = dao.getCleaningHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val unreadAlertsCount = alerts.map { it.count { alert -> !alert.read } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), 0)

    // ─── Commands ─────────────────────────────────────────────────────────────

    private val _systemStopped = MutableStateFlow(false)
    val systemStopped = _systemStopped.asStateFlow()

    fun startCleaning() {
        _systemStopped.value = false
        viewModelScope.launch {
            iotService.startCleaning()
        }
    }

    fun stopCleaning() {
        _systemStopped.value = true
        viewModelScope.launch {
            iotService.stopCleaning()
        }
    }


    fun updateConfig(config: ThresholdConfig) {
        iotService.updateConfig(config)
    }

    suspend fun getDeviceHistory(rangeHours: Int): List<DeviceHistoryDTO> {
        return iotService.getDeviceHistory(rangeHours)
    }

    fun refreshConnection(onResult: (Boolean) -> Unit) {
        viewModelScope.launch {
            val isOnline = iotService.refreshConnection()
            onResult(isOnline)
        }
    }

    // ─── Demo mode ────────────────────────────────────────────────────────────

    fun setDemoMode(enabled: Boolean) = iotService.setDemoMode(enabled)

    fun setDemoScenario(scenario: String) = iotService.setDemoScenario(scenario)

    // ─── Alerts ───────────────────────────────────────────────────────────────

    fun markAlertRead(alertId: Int) {
        viewModelScope.launch {
            dao.markAlertRead(alertId)
        }
    }
}
