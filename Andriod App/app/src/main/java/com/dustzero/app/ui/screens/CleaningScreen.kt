package com.dustzero.app.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.dustzero.app.models.AppConstants
import com.dustzero.app.ui.theme.DangerRed
import com.dustzero.app.ui.theme.PrimaryGreen
import com.dustzero.app.ui.theme.WarningAmber
import com.dustzero.app.viewmodel.MainViewModel

@Composable
fun CleaningScreen(viewModel: MainViewModel) {
    val sensorData by viewModel.sensorData.collectAsStateWithLifecycle()
    val demoModeEnabled by viewModel.demoModeEnabled.collectAsStateWithLifecycle()
    val isOnline by viewModel.isDeviceOnline.collectAsStateWithLifecycle()
    val hasFault by viewModel.hasFault.collectAsStateWithLifecycle()

    val systemStopped by viewModel.systemStopped.collectAsStateWithLifecycle()
    var showStartDialog by remember { mutableStateOf(false) }
    var showStopDialog by remember { mutableStateOf(false) }
    
    var isStarting by remember { mutableStateOf(false) }
    var isStopping by remember { mutableStateOf(false) }
    var showOfflineError by remember { mutableStateOf(false) }

    // Use AppConstants.isActivelyCleaning() to match exact ESP32 schema state values:
    val isCleaning = AppConstants.isActivelyCleaning(sensorData.cleaningState)

    // Device is offline when NOT online AND not in demo mode
    val isOffline = !isOnline && !demoModeEnabled

    // Start: requires online (or demo), not already cleaning, no rain, no fault
    val canStart = (isOnline || demoModeEnabled) && !isCleaning && !sensorData.rainDetected && !hasFault
    // Stop: requires online (or demo) and an active cleaning cycle
    val canStop = (isOnline || demoModeEnabled) && isCleaning

    LaunchedEffect(isCleaning, hasFault) {
        if (isCleaning) {
            isStarting = false
        }
        if (!isCleaning) {
            isStopping = false
        }
        if (hasFault) {
            isStarting = false
        }
    }

    LaunchedEffect(isStarting) {
        if (isStarting) {
            kotlinx.coroutines.delay(13000)
            if (isStarting) {
                isStarting = false
                showOfflineError = true
            }
        }
    }

    LaunchedEffect(isStopping) {
        if (isStopping) {
            kotlinx.coroutines.delay(13000)
            if (isStopping) {
                isStopping = false
                showOfflineError = true
            }
        }
    }

    val scrollState = rememberScrollState()

    val stateColor = when {
        hasFault -> DangerRed
        isOffline -> MaterialTheme.colorScheme.onSurfaceVariant
        isCleaning -> MaterialTheme.colorScheme.secondary
        else -> PrimaryGreen
    }

    val progressFloat = if (isCleaning) sensorData.cleaningProgress / 100f else 0f
    val animatedProgress by animateFloatAsState(targetValue = progressFloat, animationSpec = tween(600), label = "progress")
    val progressPercent = (animatedProgress * 100).toInt()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = 20.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        // ── Header ───────────────────────────────────────────────────────────
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Cleaning Control",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Manage and monitor the DustZero cleaning mechanism",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // ── Status Banner ────────────────────────────────────────────────────
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = stateColor.copy(alpha = 0.08f)
            ),
            border = BorderStroke(1.dp, stateColor.copy(alpha = 0.25f))
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = when {
                        isOffline -> Icons.Rounded.WifiOff
                        isCleaning -> Icons.Rounded.CleaningServices
                        else -> Icons.Rounded.CheckCircle
                    },
                    contentDescription = null,
                    tint = stateColor,
                    modifier = Modifier.size(28.dp)
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    text = when {
                        isOffline -> "DEVICE OFFLINE"
                        isCleaning -> "CLEANING IN PROGRESS"
                        else -> "READY TO CLEAN"
                    },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = stateColor
                )
            }
        }

        // ── Cleaning Progress ────────────────────────────────────────────────
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(
                    text = "Cleaning Progress",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Both states are rendered as a centered unit within a Box
                // so the card always looks balanced regardless of state
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 120.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (isCleaning) {
                        // ── Active progress state — centered block ──
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            // Phase label (human-readable) + percentage on same row
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = AppConstants.cleaningStateLabel(sensorData.cleaningState),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = stateColor
                                )
                                Text(
                                    text = "$progressPercent%",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = stateColor
                                )
                            }
                            Spacer(modifier = Modifier.height(12.dp))
                            LinearProgressIndicator(
                                progress = { animatedProgress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(10.dp)
                                    .clip(RoundedCornerShape(5.dp)),
                                color = stateColor,
                                trackColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        }
                    } else {
                        // ── Idle / Ready state — centered icon + text ──
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Rounded.CleaningServices,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.35f),
                                modifier = Modifier.size(60.dp)
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = "Armed — waiting for conditions",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                textAlign = TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            
                            // Live Conditions List
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f), RoundedCornerShape(8.dp))
                                    .padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                InfoRow("Sunlight Level", sensorData.sunlightLevel)
                                InfoRow("Rain Sensor", if (sensorData.rainDetected) "Detected" else "Clear")
                                InfoRow("Solar Power", "%.3fW (threshold: 0.050W)".format(sensorData.solarPower))
                            }
                            
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = when {
                                    systemStopped -> "System is currently halted via Emergency Stop."
                                    sensorData.rainDetected -> "Blocked — rain detected"
                                    isOffline -> "Device offline"
                                    else -> "System will start cleaning automatically when sunlight is strong, no rain is detected, and solar power is below 0.05W."
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f),
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
            }
        }


        // ── Cycle Information ────────────────────────────────────────────────
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    "Cycle Information",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(12.dp))
                InfoRow(
                    label = "Current Cycle",
                    value = if (isCleaning) "In Progress" else "No active cycle"
                )
                Spacer(modifier = Modifier.height(6.dp))
                InfoRow(label = "Last Cleaning", value = "2026-09-11 14:30")
                Spacer(modifier = Modifier.height(6.dp))
                InfoRow(
                    label = "Next Cleaning",
                    value = if (sensorData.rainDetected) "Blocked (rain)" else "Available"
                )
            }
        }

        // ── Action Buttons ───────────────────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // START — filled green primary action
            Button(
                onClick = { 
                    if (!canStart) {
                        showOfflineError = true
                    } else {
                        showStartDialog = true
                    }
                },
                enabled = true,
                modifier = Modifier
                    .weight(1f)
                    .height(60.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (!canStart) PrimaryGreen.copy(alpha = 0.28f) else PrimaryGreen,
                    contentColor = if (!canStart) Color.White.copy(alpha = 0.45f) else Color.White
                ),
                shape = RoundedCornerShape(14.dp)
            ) {
                if (isStarting) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text(
                        if (showOfflineError && !canStart) "UNAVAILABLE" else "ENABLE AUTOMATIC CLEANING",
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
            // STOP — filled danger action (high-priority red)
            Button(
                onClick = { 
                    if (!canStop && !systemStopped) {
                        showOfflineError = true
                    } else {
                        showStopDialog = true 
                    }
                },
                enabled = true,
                modifier = Modifier
                    .weight(1f)
                    .height(60.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (!canStop) DangerRed.copy(alpha = 0.25f) else DangerRed,
                    contentColor = if (!canStop) Color.White.copy(alpha = 0.45f) else Color.White
                ),
                shape = RoundedCornerShape(14.dp)
            ) {
                if (isStopping) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), color = Color.White, strokeWidth = 2.dp)
                } else {
                    Text(
                        if (showOfflineError && !canStop && !systemStopped) "UNAVAILABLE" else "EMERGENCY STOP",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        if (systemStopped) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = WarningAmber.copy(alpha = 0.08f)
                ),
                border = BorderStroke(1.dp, WarningAmber.copy(alpha = 0.3f))
            ) {
                Text(
                    text = "System stopped — press Enable to resume automatic operation.",
                    modifier = Modifier.padding(14.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )
            }
        } else if (sensorData.rainDetected) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondary.copy(alpha = 0.08f)
                ),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.3f))
            ) {
                Text(
                    text = "⚠ Rain detected — cleaning is blocked for panel protection.",
                    modifier = Modifier.padding(14.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Medium
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
    }

    // ── Dialogs ──────────────────────────────────────────────────────────────
    if (showStartDialog) {
        AlertDialog(
            onDismissRequest = { showStartDialog = false },
            title = { Text("Enable Automatic Cleaning?") },
            text = { Text("This will arm the system. Cleaning will start automatically when conditions are met (strong sun, no rain, power < 0.05W).") },
            confirmButton = {
                Button(
                    onClick = {
                        isStarting = true
                        viewModel.startCleaning()
                        showStartDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen)
                ) {
                    Text("Enable")
                }
            },
            dismissButton = {
                TextButton(onClick = { showStartDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (showStopDialog) {
        AlertDialog(
            onDismissRequest = { showStopDialog = false },
            title = { Text("Emergency Stop?") },
            text = { Text("This will immediately halt the motor. The system will remain stopped until you enable it again.") },
            confirmButton = {
                Button(
                    onClick = {
                        isStopping = true
                        viewModel.stopCleaning()
                        showStopDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) {
                    Text("Stop")
                }
            },
            dismissButton = {
                TextButton(onClick = { showStopDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
