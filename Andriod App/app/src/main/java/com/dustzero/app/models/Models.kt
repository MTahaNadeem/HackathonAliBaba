package com.dustzero.app.models

/**
 * Domain model for live sensor data received from the `devices` Supabase table.
 *
 * cleaning_state enum values (as written by ESP32 firmware):
 *   IDLE          — motor stopped, no active cycle
 *   MOVING_DOWN   — wiper moving down the panel
 *   PAUSE_BOTTOM  — wiper paused at the bottom end
 *   MOVING_UP     — wiper returning to top
 *
 * isOnline is NOT a raw Supabase column — it is derived in SupabaseIotService
 * by combining `connected == true` AND `updatedAt` being within the last 30s.
 * This guards against stale `connected` values when the ESP32 loses power ungracefully.
 */
data class SensorData(
    val deviceId: String = AppConstants.DEVICE_ID,
    val connected: Boolean = true,
    val ldr1: Int = 47,
    val ldr2: Int = 71,
    val temperature: Double = 38.19,
    val solarVoltage: Double = 0.85,
    val solarCurrent: Double = 124.5,
    val solarPower: Double = 0.11,
    val rainDetected: Boolean = false,
    val sunDetected: Boolean = true,
    val sunlightLevel: String = "STRONG",
    val cleaningState: String = "IDLE",
    val cleaningProgress: Int = 0,
    val cleaningSteps: Int = 0,
    val fault: Boolean = false,
    // Epoch millis of last update; 0 means unknown (not yet received from Supabase).
    // Populated from devices.updated_at parsed ISO-8601 string.
    val updatedAtMs: Long = 0L,
    // Derived: connected == true AND updatedAt within HEARTBEAT_TIMEOUT_MS.
    // Always computed by the service layer, never stored in Supabase.
    val isOnline: Boolean = false
)

data class ThresholdConfig(
    val sunDetectionThreshold: Int = 200,
    val expectedPowerClean: Double = 0.12,
    val powerDropTriggerPercent: Double = 40.0,
    val rainProtectionEnabled: Boolean = true,
    val autoCleaningEnabled: Boolean = true,
    val cleaningDistanceSteps: Int = 500,
    val cleaningCooldownMs: Long = 30 * 60 * 1000 // 30 mins
)
