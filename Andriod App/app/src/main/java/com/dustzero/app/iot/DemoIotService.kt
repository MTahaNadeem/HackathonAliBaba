package com.dustzero.app.iot

import com.dustzero.app.data.AlertEntity
import com.dustzero.app.data.AppDao
import com.dustzero.app.data.CleaningHistoryEntity
import com.dustzero.app.models.AppConstants
import com.dustzero.app.models.SensorData
import com.dustzero.app.models.ThresholdConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Demo / simulation IoT service.
 *
 * Uses the exact same cleaning_state values as the real ESP32 firmware:
 *   IDLE, MOVING_DOWN, PAUSE_BOTTOM, MOVING_UP
 *
 * This ensures the Cleaning screen UI logic (AppConstants.isActivelyCleaning,
 * AppConstants.cleaningStateLabel) works identically in demo and production modes.
 */
class DemoIotService(private val dao: AppDao) : IotService {
    private val scope = CoroutineScope(Dispatchers.Default)

    private val _sensorData = MutableStateFlow(SensorData())
    override val sensorData: StateFlow<SensorData> = _sensorData.asStateFlow()

    private val _demoModeEnabled = MutableStateFlow(true)
    override val demoModeEnabled: StateFlow<Boolean> = _demoModeEnabled.asStateFlow()

    private val _config = MutableStateFlow(ThresholdConfig())
    override val config: StateFlow<ThresholdConfig> = _config.asStateFlow()

    override fun setDemoMode(enabled: Boolean) {
        _demoModeEnabled.value = enabled
        if (!enabled) {
            _sensorData.update { it.copy(connected = false, isOnline = false) }
        } else {
            setDemoScenario("NORMAL")
        }
    }

    override suspend fun startCleaning() {
        if (_sensorData.value.rainDetected) return
        if (AppConstants.isActivelyCleaning(_sensorData.value.cleaningState)) return

        val startTime = System.currentTimeMillis()

        // Use exact schema values: MOVING_DOWN, PAUSE_BOTTOM, MOVING_UP, IDLE
        _sensorData.update { it.copy(cleaningState = AppConstants.STATE_MOVING_DOWN, cleaningProgress = 0) }
        simulateProgress(0..50)

        _sensorData.update { it.copy(cleaningState = AppConstants.STATE_PAUSE_BOTTOM) }
        delay(2000)

        _sensorData.update { it.copy(cleaningState = AppConstants.STATE_MOVING_UP) }
        simulateProgress(50..100)

        _sensorData.update {
            it.copy(
                cleaningState = AppConstants.STATE_IDLE,
                cleaningProgress = 0,
                solarPower = _config.value.expectedPowerClean,
                solarVoltage = 0.9,
                solarCurrent = 133.0
            )
        }

        val endTime = System.currentTimeMillis()
        dao.insertCleaningHistory(
            CleaningHistoryEntity(
                triggerType = "Manual",
                startTime = startTime,
                endTime = endTime,
                status = "Completed",
                durationSeconds = (endTime - startTime) / 1000
            )
        )
        dao.insertAlert(AlertEntity(
            type = "Cleaning",
            severity = "INFO",
            message = "CLEANING COMPLETED - Cleaning cycle completed successfully."
        ))
    }

    override suspend fun stopCleaning() {
        // Return to IDLE — mirrors what the ESP32 firmware does on STOP_CLEANING
        _sensorData.update { it.copy(cleaningState = AppConstants.STATE_IDLE, cleaningProgress = 0) }
    }


    override fun updateConfig(newConfig: ThresholdConfig) {
        _config.value = newConfig
    }

    override fun setDemoScenario(scenario: String) {
        when (scenario) {
            "NORMAL" -> {
                _sensorData.update {
                    it.copy(
                        connected = true,
                        isOnline = true,
                        ldr1 = 47,
                        ldr2 = 71,
                        rainDetected = false,
                        sunDetected = true,
                        sunlightLevel = "STRONG",
                        solarPower = 0.11,
                        cleaningState = AppConstants.STATE_IDLE,
                        fault = false
                    )
                }
            }
            "DUST" -> {
                _sensorData.update {
                    it.copy(
                        connected = true,
                        isOnline = true,
                        ldr1 = 47,
                        ldr2 = 71,
                        rainDetected = false,
                        sunDetected = true,
                        sunlightLevel = "STRONG",
                        solarPower = 0.06,
                        cleaningState = AppConstants.STATE_IDLE,
                        fault = false
                    )
                }
                scope.launch {
                    dao.insertAlert(AlertEntity(
                        type = "Performance",
                        severity = "WARNING",
                        message = "LOW SOLAR OUTPUT - Power output is significantly below baseline. Possible dust accumulation."
                    ))
                }
            }
            "CLOUDY" -> {
                _sensorData.update {
                    it.copy(
                        connected = true,
                        isOnline = true,
                        ldr1 = 850,
                        ldr2 = 910,
                        rainDetected = false,
                        sunDetected = false,
                        sunlightLevel = "WEAK",
                        solarPower = 0.03,
                        cleaningState = AppConstants.STATE_IDLE,
                        fault = false
                    )
                }
            }
            "RAIN" -> {
                _sensorData.update {
                    it.copy(
                        connected = true,
                        isOnline = true,
                        rainDetected = true,
                        sunDetected = false,
                        sunlightLevel = "WEAK",
                        solarPower = 0.01,
                        cleaningState = AppConstants.STATE_IDLE,
                        fault = false
                    )
                }
                scope.launch {
                    dao.insertAlert(AlertEntity(
                        type = "Safety",
                        severity = "WARNING",
                        message = "RAIN DETECTED - Automatic cleaning blocked for panel protection."
                    ))
                }
            }
            "FAULT" -> {
                _sensorData.update {
                    it.copy(
                        connected = true,
                        isOnline = true,
                        cleaningState = AppConstants.STATE_IDLE,
                        fault = true
                    )
                }
                scope.launch {
                    dao.insertAlert(AlertEntity(
                        type = "Fault",
                        severity = "CRITICAL",
                        message = "SYSTEM FAULT - The ESP32 has reported a hardware fault. Manual inspection required."
                    ))
                }
            }
            "OFFLINE" -> {
                _sensorData.update { it.copy(connected = false, isOnline = false) }
                scope.launch {
                    dao.insertAlert(AlertEntity(
                        type = "Connection",
                        severity = "CRITICAL",
                        message = "DEVICE OFFLINE - ESP32 stopped sending heartbeats. Check Wi-Fi and power."
                    ))
                }
            }
        }
    }

    private suspend fun simulateProgress(range: IntRange) {
        val totalSteps = config.value.cleaningDistanceSteps
        for (i in range) {
            if (!AppConstants.isActivelyCleaning(_sensorData.value.cleaningState)) break
            delay(100)
            val currentSteps = (totalSteps * (i / 100.0)).toInt()
            _sensorData.update { it.copy(cleaningProgress = i, cleaningSteps = currentSteps) }
        }
    }

    override suspend fun getDeviceHistory(rangeHours: Int): List<DeviceHistoryDTO> {
        delay(800) // Simulate network delay
        if (rangeHours == 24) {
            // Generate some mock history data
            val now = System.currentTimeMillis()
            val list = mutableListOf<DeviceHistoryDTO>()
            for (i in 0 until 12) {
                val time = now - ((12 - i) * 2 * 60 * 60 * 1000L)
                val iso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }.format(time)
                list.add(DeviceHistoryDTO(
                    deviceId = AppConstants.DEVICE_ID,
                    recordedAt = iso,
                    solarPower = 0.05 + (i * 0.01),
                    solarVoltage = 0.8 + (i * 0.01),
                    temperature = 30.0 + i
                ))
            }
            return list
        }
        return emptyList()
    }

    override suspend fun refreshConnection(): Boolean {
        delay(1000)
        return _sensorData.value.isOnline
    }
}
