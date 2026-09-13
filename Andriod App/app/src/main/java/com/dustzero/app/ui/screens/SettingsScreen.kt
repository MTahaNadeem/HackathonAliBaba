package com.dustzero.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.dustzero.app.data.ThemeMode
import com.dustzero.app.ui.theme.PrimaryGreen
import com.dustzero.app.viewmodel.MainViewModel
import kotlinx.coroutines.launch
import com.dustzero.app.models.AppConstants

@Composable
fun SettingsScreen(viewModel: MainViewModel) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val versionName = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "Unknown"
    } catch (e: Exception) {
        "Unknown"
    }

    val demoModeEnabled by viewModel.demoModeEnabled.collectAsStateWithLifecycle()
    val scrollState = rememberScrollState()
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    var isRefreshing by remember { mutableStateOf(false) }
    
    // Local UI state for settings (mock)
    var autoCleaning by remember { mutableStateOf(true) }
    var pushAlerts by remember { mutableStateOf(true) }
    var offlineAlerts by remember { mutableStateOf(false) }
    var showAboutDialog by remember { mutableStateOf(false) }

    var cleaningCooldown by remember { mutableStateOf("30") }
    var cleaningDistance by remember { mutableStateOf("500") }
    
    var sunlightThreshold by remember { mutableStateOf("200") }
    var powerBaseline by remember { mutableStateOf("0.05") }

    if (showAboutDialog) {
        AlertDialog(
            onDismissRequest = { showAboutDialog = false },
            title = { Text(AppConstants.APP_NAME, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(AppConstants.APP_SUBTITLE, style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Version: $versionName", style = MaterialTheme.typography.labelSmall)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("DustZero is an automated solar panel cleaning system designed to maintain peak efficiency. This companion app provides real-time monitoring and manual overrides for your hardware.", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Developed by MTahaNadeem", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
                }
            },
            confirmButton = {
                TextButton(onClick = { showAboutDialog = false }) {
                    Text("OK")
                }
            }
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        modifier = Modifier.fillMaxSize()
    ) { paddingValues ->
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .background(MaterialTheme.colorScheme.background)
            .padding(paddingValues)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Settings",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Preferences and device configuration",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        SettingsSection(title = "DEVICE") {
            SettingRowInfo(icon = Icons.Rounded.DeveloperBoard, label = "Device Name", value = "DustZero Cleaning System 01")
            Spacer(modifier = Modifier.height(12.dp))
            SettingRowInfo(icon = Icons.Rounded.QrCode, label = "Device ID", value = "dustzero-001")
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            SettingRowInfo(icon = Icons.Rounded.Memory, label = "Firmware Version", value = "1.0.0")
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                OutlinedButton(
                    onClick = { 
                        if (!isRefreshing) {
                            isRefreshing = true
                            viewModel.refreshConnection { isOnline ->
                                isRefreshing = false
                                scope.launch {
                                    if (isOnline) {
                                        snackbarHostState.showSnackbar("Connection refreshed — Device Online")
                                    } else {
                                        snackbarHostState.showSnackbar("Device Offline — Unable to reach device")
                                    }
                                }
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (isRefreshing) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Refreshing...", fontWeight = FontWeight.Bold)
                    } else {
                        Icon(Icons.Rounded.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Refresh Connection", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        SettingsSection(title = "CLEANING CONFIGURATIONS") {
            SettingRowSwitch(
                icon = Icons.Rounded.Autorenew,
                label = "Automatic Cleaning",
                description = "Trigger cleaning based on sensor data",
                checked = autoCleaning,
                onCheckedChange = { autoCleaning = it }
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            SettingRowInput(
                icon = Icons.Rounded.Timer,
                label = "Cleaning Cooldown (mins)",
                value = cleaningCooldown,
                onValueChange = { cleaningCooldown = it }
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            SettingRowInput(
                icon = Icons.Rounded.Straighten,
                label = "Cleaning Distance (steps)",
                value = cleaningDistance,
                onValueChange = { cleaningDistance = it }
            )
        }
        
        SettingsSection(title = "THRESHOLDS") {
            SettingRowInput(
                icon = Icons.Rounded.WbSunny,
                label = "Sunlight Threshold",
                value = sunlightThreshold,
                onValueChange = { sunlightThreshold = it }
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            SettingRowInput(
                icon = Icons.Rounded.ElectricBolt,
                label = "Power Baseline Threshold",
                value = powerBaseline,
                onValueChange = { powerBaseline = it }
            )
        }

        SettingsSection(title = "APPEARANCE") {
            val currentTheme by viewModel.themeMode.collectAsStateWithLifecycle()
            
            Column(modifier = Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Rounded.Palette,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(text = "Theme", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                        Text(text = "Choose how DustZero looks", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    SegmentedButton(
                        selected = currentTheme == ThemeMode.LIGHT,
                        onClick = { viewModel.setThemeMode(ThemeMode.LIGHT) },
                        shape = SegmentedButtonDefaults.itemShape(index = 0, count = 3)
                    ) {
                        Text("Light")
                    }
                    SegmentedButton(
                        selected = currentTheme == ThemeMode.DARK,
                        onClick = { viewModel.setThemeMode(ThemeMode.DARK) },
                        shape = SegmentedButtonDefaults.itemShape(index = 1, count = 3)
                    ) {
                        Text("Dark")
                    }
                    SegmentedButton(
                        selected = currentTheme == ThemeMode.SYSTEM,
                        onClick = { viewModel.setThemeMode(ThemeMode.SYSTEM) },
                        shape = SegmentedButtonDefaults.itemShape(index = 2, count = 3)
                    ) {
                        Text("System")
                    }
                }
            }
        }
        
        SettingsSection(title = "DEVELOPER & DEMO") {
            SettingRowSwitch(
                icon = Icons.Rounded.Science,
                label = "Demo Mode",
                description = "Simulate hardware data",
                checked = demoModeEnabled,
                onCheckedChange = { viewModel.setDemoMode(it) }
            )
            if (demoModeEnabled) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Trigger Scenario", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    Spacer(modifier = Modifier.height(12.dp))
                    val scenarios = listOf("NORMAL", "DUST", "CLOUDY", "RAIN", "FAULT", "OFFLINE")
                    scenarios.forEach { scenario ->
                        OutlinedButton(
                            onClick = { viewModel.setDemoScenario(scenario) },
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Simulate $scenario")
                        }
                    }
                }
            }
        }
        
        SettingsSection(title = "APP") {
            SettingRowAction(
                icon = Icons.Rounded.Info, 
                label = "About DustZero", 
                onClick = { showAboutDialog = true }
            )
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
            SettingRowInfo(icon = Icons.Rounded.SystemUpdate, label = "App Version", value = versionName)
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
    }
}

@Composable
fun SettingsSection(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 16.dp, bottom = 8.dp)
        )
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(content = content)
        }
    }
}

@Composable
fun SettingRowInfo(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(text = label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
        }
        if (value.isNotEmpty()) {
            Text(text = value, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            Icon(
                imageVector = Icons.Rounded.ChevronRight,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun SettingRowSwitch(
    icon: ImageVector,
    label: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(text = label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                Text(text = description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = PrimaryGreen
            )
        )
    }
}

@Composable
fun SettingRowInput(
    icon: ImageVector,
    label: String,
    value: String,
    onValueChange: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(text = label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
        }
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.width(100.dp),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = PrimaryGreen,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f)
            )
        )
    }
}

@Composable
fun SettingRowAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(text = label, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
        }
        Icon(
            imageVector = Icons.Rounded.ChevronRight,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp)
        )
    }
}
