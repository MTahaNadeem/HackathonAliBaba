package com.dustzero.app.iot

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * DTO matching the `devices` table in Supabase exactly.
 * Columns: id (not mapped — not needed), device_id, connected, ldr1, ldr2,
 * temperature, solar_voltage, solar_current, solar_power, rain_detected,
 * sun_detected, sunlight_level, cleaning_state, cleaning_progress,
 * cleaning_steps, fault, updated_at.
 *
 * cleaning_state values from ESP32: IDLE | MOVING_DOWN | PAUSE_BOTTOM | MOVING_UP | PAUSE_TOP
 * sunlight_level values from ESP32: WEAK | MEDIUM | STRONG
 */
@Serializable
data class DeviceDTO(
    @SerialName("device_id") val deviceId: String,
    val connected: Boolean = false,
    val ldr1: Int = 0,
    val ldr2: Int = 0,
    val temperature: Double = 0.0,
    @SerialName("solar_voltage") val solarVoltage: Double = 0.0,
    @SerialName("solar_current") val solarCurrent: Double = 0.0,
    @SerialName("solar_power") val solarPower: Double = 0.0,
    @SerialName("rain_detected") val rainDetected: Boolean = false,
    @SerialName("sun_detected") val sunDetected: Boolean = false,
    @SerialName("sunlight_level") val sunlightLevel: String = "WEAK",
    @SerialName("cleaning_state") val cleaningState: String = "IDLE",
    @SerialName("cleaning_progress") val cleaningProgress: Int = 0,
    @SerialName("cleaning_steps") val cleaningSteps: Int = 0,
    val fault: Boolean = false,
    // updated_at is an ISO-8601 string from Supabase (timestamptz)
    // Used to detect heartbeat freshness for online/offline status
    @SerialName("updated_at") val updatedAt: String? = null
)

/**
 * DTO for inserting into the `commands` table.
 * status is always 'PENDING' when inserted from the app;
 * the ESP32 updates it to ACKNOWLEDGED / COMPLETED / FAILED.
 * command values: START_CLEANING | STOP_CLEANING
 */
@Serializable
data class CommandDTO(
    @SerialName("device_id") val deviceId: String,
    val command: String,
    val status: String = "PENDING"
)

/**
 * DTO matching the `device_history` table in Supabase.
 */
@Serializable
data class DeviceHistoryDTO(
    @SerialName("device_id") val deviceId: String,
    @SerialName("recorded_at") val recordedAt: String,
    @SerialName("solar_power") val solarPower: Double = 0.0,
    @SerialName("solar_voltage") val solarVoltage: Double = 0.0,
    @SerialName("solar_current") val solarCurrent: Double = 0.0,
    val temperature: Double = 0.0,
    val ldr1: Int = 0,
    val ldr2: Int = 0,
    @SerialName("sunlight_level") val sunlightLevel: String = "WEAK",
    @SerialName("rain_detected") val rainDetected: Boolean = false,
    @SerialName("cleaning_state") val cleaningState: String = "IDLE"
)
