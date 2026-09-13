package com.dustzero.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface AppDao {
    @Query("SELECT * FROM alerts ORDER BY timestamp DESC")
    fun getAllAlerts(): Flow<List<AlertEntity>>

    @Insert
    suspend fun insertAlert(alert: AlertEntity)

    @Query("UPDATE alerts SET read = 1 WHERE id = :alertId")
    suspend fun markAlertRead(alertId: Int)

    @Query("SELECT * FROM cleaning_history ORDER BY startTime DESC")
    fun getCleaningHistory(): Flow<List<CleaningHistoryEntity>>

    @Insert
    suspend fun insertCleaningHistory(history: CleaningHistoryEntity)
}
