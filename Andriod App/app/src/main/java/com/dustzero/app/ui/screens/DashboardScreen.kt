package com.dustzero.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.dustzero.app.models.AppConstants
import com.dustzero.app.ui.theme.DangerRed
import com.dustzero.app.ui.theme.PrimaryGreen
import com.dustzero.app.ui.theme.WarningAmber
import com.dustzero.app.viewmodel.MainViewModel
import com.dustzero.app.ui.components.MetricCard
import com.dustzero.app.ui.components.StatusCard

@Composable
fun DashboardScreen(viewModel: MainViewModel) {
    val scrollState = rememberScrollState()
    val sensorData by viewModel.sensorData.collectAsStateWithLifecycle()
    val panelStatus by viewModel.panelStatus.collectAsStateWithLifecycle()
    val isOnline by viewModel.isDeviceOnline.collectAsStateWithLifecycle()
    val hasFault by viewModel.hasFault.collectAsStateWithLifecycle()

    var isStarting by remember { mutableStateOf(false) }
    var showOfflineError by remember { mutableStateOf(false) }

    // Derive display values from live sensor data
    val isCleaning = AppConstants.isActivelyCleaning(sensorData.cleaningState)
    val canStart = isOnline && !isCleaning && !sensorData.rainDetected && !hasFault
    val canStop = isOnline && isCleaning

    LaunchedEffect(isCleaning, hasFault) {
        if (isCleaning || hasFault) {
            isStarting = false
        }
    }

    LaunchedEffect(isStarting) {
        if (isStarting) {
            kotlinx.coroutines.delay(15000)
            if (isStarting) {
                isStarting = false
                showOfflineError = true // Reuse this flag to show error on button
            }
        }
    }


    val heroColor = when (panelStatus) {
        "OPTIMAL" -> PrimaryGreen
        "CLEANING" -> MaterialTheme.colorScheme.secondary
        "POSSIBLE DUST" -> WarningAmber
        "RAIN DETECTED" -> MaterialTheme.colorScheme.secondary
        "LOW SUNLIGHT" -> WarningAmber
        "FAULT" -> DangerRed
        else -> DangerRed // OFFLINE
    }
    val heroIcon = when (panelStatus) {
        "OPTIMAL" -> Icons.Rounded.CheckCircle
        "CLEANING" -> Icons.Rounded.CleaningServices
        "POSSIBLE DUST" -> Icons.Rounded.Warning
        "RAIN DETECTED" -> Icons.Rounded.CloudQueue
        "LOW SUNLIGHT" -> Icons.Rounded.WbCloudy
        "FAULT" -> Icons.Rounded.Error
        else -> Icons.Rounded.CloudOff
    }
    val heroDescription = when (panelStatus) {
        "OPTIMAL" -> "Strong sunlight detected. Panel performance is ideal."
        "CLEANING" -> "Cleaning cycle is currently active — ${AppConstants.cleaningStateLabel(sensorData.cleaningState)}."
        "POSSIBLE DUST" -> "Power output below baseline — dust accumulation likely."
        "RAIN DETECTED" -> "Rain detected. Cleaning is temporarily blocked."
        "LOW SUNLIGHT" -> "Insufficient sunlight for accurate performance reading."
        "FAULT" -> "Hardware fault reported. Manual inspection required."
        else -> "Device offline. Check Wi-Fi and cloud connection."
    }

    val sunlightStatus = sensorData.sunlightLevel.ifBlank { if (sensorData.sunDetected) "DETECTED" else "LOW" }
    val rainStatus = if (sensorData.rainDetected) "RAIN" else "NO RAIN"
    val rainColor = if (sensorData.rainDetected) DangerRed else PrimaryGreen
    val ldrDescription = "LDR1: ${sensorData.ldr1}\nLDR2: ${sensorData.ldr2}"
    val rainDescription = if (sensorData.rainDetected) "Cleaning blocked" else "Safe for cleaning"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // ── Top Header ───────────────────────────────────────────────────────
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "DustZero",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Black,
                letterSpacing = 2.sp,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(if (isOnline) PrimaryGreen else DangerRed)
                )
                if (isOnline) {
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "LIVE",
                        style = MaterialTheme.typography.labelSmall,
                        color = PrimaryGreen,
                        fontWeight = FontWeight.Black
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isOnline) "Connected · ESP32-S3-001" else "Device Offline",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isOnline)
                        MaterialTheme.colorScheme.onSurfaceVariant
                    else
                        DangerRed
                )
            }
        }

        // ── Fault Banner (only shown when fault == true) ─────────────────────
        if (hasFault) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = DangerRed.copy(alpha = 0.1f)),
                border = androidx.compose.foundation.BorderStroke(1.dp, DangerRed.copy(alpha = 0.4f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Error,
                        contentDescription = "Fault",
                        tint = DangerRed,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = "SYSTEM FAULT",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = DangerRed
                        )
                        Text(
                            text = "ESP32 reported a hardware fault. Manual inspection required.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }

        // ── Hero Status Banner ───────────────────────────────────────────────
        StatusCard(
            title = "PANEL STATUS",
            status = panelStatus,
            icon = heroIcon,
            color = heroColor,
            description = heroDescription
        )

        // ── Key Metrics — Row 1 ──────────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            MetricCard(
                title = "Solar Power",
                value = "%.2f".format(sensorData.solarPower),
                unit = "W",
                icon = Icons.Rounded.WbSunny,
                iconTint = WarningAmber,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Voltage",
                value = "%.2f".format(sensorData.solarVoltage),
                unit = "V",
                icon = Icons.Rounded.ElectricBolt,
                iconTint = MaterialTheme.colorScheme.secondary,
                modifier = Modifier.weight(1f)
            )
        }

        // ── Key Metrics — Row 2 ──────────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            MetricCard(
                title = "Current",
                value = "%.1f".format(sensorData.solarCurrent),
                unit = "mA",
                icon = Icons.Rounded.BatteryChargingFull,
                iconTint = MaterialTheme.colorScheme.secondary,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                title = "Temperature",
                value = "%.1f".format(sensorData.temperature),
                unit = "°C",
                icon = Icons.Rounded.Thermostat,
                iconTint = DangerRed,
                modifier = Modifier.weight(1f)
            )
        }

        // ── Environment — Sunlight & Rain (equal-height via IntrinsicSize.Min) ─
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min),
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            StatusCard(
                title = "Sunlight",
                status = sunlightStatus,
                icon = Icons.Rounded.WbSunny,
                color = WarningAmber,
                description = ldrDescription,
                modifier = Modifier.weight(1f)
            )
            StatusCard(
                title = "Rain Sensor",
                status = rainStatus,
                icon = Icons.Rounded.CloudQueue,
                color = rainColor,
                description = rainDescription,
                modifier = Modifier.weight(1f)
            )
        }

        // ── Quick Actions ────────────────────────────────────────────────────
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Quick Actions",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Button(
                        onClick = { 
                            if (!canStart) {
                                showOfflineError = true
                            } else {
                                isStarting = true
                                viewModel.startCleaning()
                            }
                        },
                        enabled = true, // We handle disabled state manually to show errors
                        modifier = Modifier.weight(1f).height(56.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (!canStart) PrimaryGreen.copy(alpha = 0.3f) else PrimaryGreen,
                            contentColor = if (!canStart) Color.White.copy(alpha = 0.5f) else Color.White,
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (isStarting) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text(if (showOfflineError && !canStart) "Unavailable" else "START", fontWeight = FontWeight.Bold)
                        }
                    }
                    Button(
                        onClick = { viewModel.stopCleaning() },
                        enabled = canStop,
                        modifier = Modifier.weight(1f).height(56.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = DangerRed,
                            contentColor = Color.White,
                            disabledContainerColor = DangerRed.copy(alpha = 0.25f),
                            disabledContentColor = Color.White.copy(alpha = 0.5f)
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("STOP", fontWeight = FontWeight.Bold)
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = if (isCleaning)
                        AppConstants.cleaningStateLabel(sensorData.cleaningState)
                    else
                        "System Ready",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
