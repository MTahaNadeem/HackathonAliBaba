package com.dustzero.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.dustzero.app.models.AppConstants

@Entity(tableName = "alerts")
data class AlertEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val deviceId: String = AppConstants.DEVICE_ID,
    val type: String,
    val severity: String, // INFO, WARNING, CRITICAL
    val message: String,
    val timestamp: Long = System.currentTimeMillis(),
    val read: Boolean = false
)

@Entity(tableName = "cleaning_history")
data class CleaningHistoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val deviceId: String = AppConstants.DEVICE_ID,
    val triggerType: String, // Manual, Automatic
    val startTime: Long,
    val endTime: Long,
    val status: String,
    val durationSeconds: Long
)
