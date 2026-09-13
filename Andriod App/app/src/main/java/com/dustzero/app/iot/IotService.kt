package com.dustzero.app.iot

import com.dustzero.app.models.SensorData
import com.dustzero.app.models.ThresholdConfig
import kotlinx.coroutines.flow.StateFlow

interface IotService {
    val sensorData: StateFlow<SensorData>
    val demoModeEnabled: StateFlow<Boolean>
    val config: StateFlow<ThresholdConfig>

    fun setDemoMode(enabled: Boolean)
    suspend fun startCleaning()
    suspend fun stopCleaning()
    suspend fun homeMotor()
    fun updateConfig(newConfig: ThresholdConfig)
    fun setDemoScenario(scenario: String)
    suspend fun getDeviceHistory(rangeHours: Int): List<DeviceHistoryDTO>
    suspend fun refreshConnection(): Boolean
}
