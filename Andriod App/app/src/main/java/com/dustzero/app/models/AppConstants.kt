package com.dustzero.app.models

/**
 * Centralized application constants for DustZero.
 *
 * Edit these values to change the device ID, app version, or other
 * configuration without hunting through multiple files.
 */
object AppConstants {

    // ─── Device ──────────────────────────────────────────────────────────────

    /** The device_id used in Supabase and all cloud communication. */
    const val DEVICE_ID = "dustzero-001"

    /** Human-readable name shown in Settings > Device. */
    const val DEVICE_NAME = "DustZero Controller"

    // ─── App ─────────────────────────────────────────────────────────────────

    const val APP_NAME = "DustZero"
    const val APP_SUBTITLE = "Smart Solar Panel Cleaning System"
    const val APP_VERSION = "2.1.0"

    // ─── Supabase Tables ─────────────────────────────────────────────────────
    // Schema as of v1: two tables only — devices and commands.
    // NOTE: No `alerts` table exists in the current schema — alerts are
    // generated client-side from state changes and stored in Room (local DB).
    // NOTE: No `device_history` table exists — Analytics charts use mock data.
    // Both can be added in a future schema migration without changing this layer.

    const val TABLE_DEVICES = "devices"
    const val TABLE_COMMANDS = "commands"

    // ─── Commands (written to commands table by the app) ──────────────────────
    // command column values — ESP32 polls and executes these

    const val CMD_START_CLEANING = "START_CLEANING"
    const val CMD_STOP_CLEANING = "STOP_CLEANING"
    const val CMD_HOME_MOTOR = "HOME_MOTOR"

    // ─── Cleaning States (written by ESP32 firmware to devices.cleaning_state) ─
    // These are the exact string values the ESP32 writes — do not rename.

    const val STATE_IDLE = "IDLE"
    const val STATE_MOVING_DOWN = "MOVING_DOWN"
    const val STATE_PAUSE_BOTTOM = "PAUSE_BOTTOM"
    const val STATE_MOVING_UP = "MOVING_UP"

    /** UI-friendly labels for each cleaning_state value */
    fun cleaningStateLabel(state: String): String = when (state) {
        STATE_IDLE -> "Ready to Clean"
        STATE_MOVING_DOWN -> "Moving Down"
        STATE_PAUSE_BOTTOM -> "Paused at Bottom"
        STATE_MOVING_UP -> "Moving Up"
        else -> state // Pass through unknown states as-is
    }

    /** Returns true if the device is actively running a cleaning cycle */
    fun isActivelyCleaning(state: String): Boolean =
        state == STATE_MOVING_DOWN || state == STATE_PAUSE_BOTTOM || state == STATE_MOVING_UP

    // ─── Online / Offline Heartbeat ───────────────────────────────────────────
    // Device is considered ONLINE only if:
    //   1. devices.connected == true
    //   2. devices.updated_at was within this window
    // This prevents stale `connected = true` from showing a device as online
    // after an ungraceful power loss.

    const val HEARTBEAT_TIMEOUT_MS = 30_000L // 30 seconds

    // ─── Local Database ───────────────────────────────────────────────────────

    const val LOCAL_DB_NAME = "dustzero_database"
}
