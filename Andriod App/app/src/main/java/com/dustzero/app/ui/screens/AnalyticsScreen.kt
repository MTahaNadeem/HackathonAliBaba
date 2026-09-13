package com.dustzero.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.dustzero.app.viewmodel.MainViewModel
import com.patrykandpatrick.vico.compose.axis.horizontal.rememberBottomAxis
import com.patrykandpatrick.vico.compose.axis.vertical.rememberStartAxis
import com.patrykandpatrick.vico.compose.chart.Chart
import com.patrykandpatrick.vico.compose.chart.line.lineChart
import com.patrykandpatrick.vico.core.entry.entryModelOf
import com.patrykandpatrick.vico.compose.component.lineComponent
import com.patrykandpatrick.vico.compose.component.textComponent
import com.dustzero.app.iot.DeviceHistoryDTO
import com.patrykandpatrick.vico.core.entry.FloatEntry
import java.text.SimpleDateFormat
import java.util.Locale

@Composable
fun AnalyticsScreen(viewModel: MainViewModel) {
    val scrollState = rememberScrollState()
    
    var selectedRange by remember { mutableIntStateOf(0) }
    val ranges = listOf("24H", "7D", "30D")
    
    var history by remember { mutableStateOf<List<DeviceHistoryDTO>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }

    val sensorData by viewModel.sensorData.collectAsStateWithLifecycle()

    LaunchedEffect(selectedRange) {
        isLoading = true
        val hours = when (selectedRange) {
            0 -> 24
            1 -> 24 * 7
            else -> 24 * 30
        }
        history = viewModel.getDeviceHistory(hours)
        isLoading = false
    }

    val powerChartEntryModel = remember(history) {
        if (history.isEmpty()) return@remember entryModelOf(0f)
        val entries = history.mapIndexed { index, dto ->
            FloatEntry(x = index.toFloat(), y = dto.solarPower.toFloat())
        }
        entryModelOf(entries)
    }
    
    val tempChartEntryModel = remember(history) {
        if (history.isEmpty()) return@remember entryModelOf(0f)
        val entries = history.mapIndexed { index, dto ->
            FloatEntry(x = index.toFloat(), y = dto.temperature.toFloat())
        }
        entryModelOf(entries)
    }

    val voltageChartEntryModel = remember(history) {
        if (history.isEmpty()) return@remember entryModelOf(0f)
        val entries = history.mapIndexed { index, dto ->
            FloatEntry(x = index.toFloat(), y = dto.solarVoltage.toFloat())
        }
        entryModelOf(entries)
    }

    val currentChartEntryModel = remember(history) {
        if (history.isEmpty()) return@remember entryModelOf(0f)
        val entries = history.mapIndexed { index, dto ->
            FloatEntry(x = index.toFloat(), y = (dto.solarCurrent * 1000).toFloat()) // Convert A to mA
        }
        entryModelOf(entries)
    }

    // --- Formatters ---
    val isoFormatter = remember { SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { 
        timeZone = java.util.TimeZone.getTimeZone("UTC") 
    } }
    val displayFormatter = remember(selectedRange) {
        if (selectedRange == 0) SimpleDateFormat("HH:mm", Locale.getDefault())
        else SimpleDateFormat("MM/dd", Locale.getDefault())
    }

    // --- Summaries ---
    var strongSun = 0
    var mediumSun = 0
    var weakSun = 0
    var rainBlocks = 0
    var cleaningCycles = 0

    if (history.isNotEmpty()) {
        history.forEach { 
            when (it.sunlightLevel) {
                "STRONG" -> strongSun++
                "MEDIUM" -> mediumSun++
                else -> weakSun++
            }
            if (it.rainDetected) rainBlocks++
        }
        
        var previousState = "IDLE"
        history.forEach {
            if (previousState == "IDLE" && it.cleaningState == "MOVING_DOWN") {
                cleaningCycles++
            }
            previousState = it.cleaningState
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Analytics",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Historical performance and sensor data",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        
        SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
            ranges.forEachIndexed { index, label ->
                SegmentedButton(
                    selected = index == selectedRange,
                    onClick = { selectedRange = index },
                    shape = SegmentedButtonDefaults.itemShape(index = index, count = ranges.size)
                ) {
                    Text(label)
                }
            }
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else if (history.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth().height(200.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "No data yet for this period — check back once your device has been running a while.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(32.dp)
                    )
                }
            }
        } else {
            // Theme aware axes components
            val labelColor = MaterialTheme.colorScheme.onSurfaceVariant
            val lineColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)
            val guideColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)

            // 1. Solar Power Output
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "SOLAR POWER OUTPUT (W)",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold
                        )
                        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(8.dp)) {
                            Text(
                                "Now: ${String.format(Locale.US, "%.2f", sensorData.solarPower)}W",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    Chart(
                        chart = lineChart(),
                        model = powerChartEntryModel,
                        startAxis = rememberStartAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp)
                        ),
                        bottomAxis = rememberBottomAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp),
                            valueFormatter = { value, _ -> 
                                val idx = value.toInt()
                                if (idx in history.indices) {
                                    val step = maxOf(1, history.size / 5)
                                    if (idx % step == 0 || idx == history.size - 1) {
                                        try {
                                            val cleanStr = history[idx].recordedAt.substringBefore(".").removeSuffix("Z")
                                            val date = isoFormatter.parse(cleanStr)
                                            date?.let { displayFormatter.format(it) } ?: ""
                                        } catch (e: Exception) { "" }
                                    } else ""
                                } else ""
                            }
                        ),
                        modifier = Modifier.height(220.dp)
                    )
                }
            }
            
            // 2. Solar Current (mA)
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "SOLAR CURRENT (mA)",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold
                        )
                        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(8.dp)) {
                            Text(
                                "Now: ${String.format(Locale.US, "%.0f", sensorData.solarCurrent * 1000)}mA",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    Chart(
                        chart = lineChart(),
                        model = currentChartEntryModel,
                        startAxis = rememberStartAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp)
                        ),
                        bottomAxis = rememberBottomAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp),
                            valueFormatter = { value, _ -> 
                                val idx = value.toInt()
                                if (idx in history.indices) {
                                    val step = maxOf(1, history.size / 5)
                                    if (idx % step == 0 || idx == history.size - 1) {
                                        try {
                                            val cleanStr = history[idx].recordedAt.substringBefore(".").removeSuffix("Z")
                                            val date = isoFormatter.parse(cleanStr)
                                            date?.let { displayFormatter.format(it) } ?: ""
                                        } catch (e: Exception) { "" }
                                    } else ""
                                } else ""
                            }
                        ),
                        modifier = Modifier.height(180.dp)
                    )
                }
            }

            // 3. Panel Temperature
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "PANEL TEMPERATURE (°C)",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold
                        )
                        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(8.dp)) {
                            Text(
                                "Now: ${String.format(Locale.US, "%.1f", sensorData.temperature)}°C",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    Chart(
                        chart = lineChart(),
                        model = tempChartEntryModel,
                        startAxis = rememberStartAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp)
                        ),
                        bottomAxis = rememberBottomAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp),
                            valueFormatter = { value, _ -> 
                                val idx = value.toInt()
                                if (idx in history.indices) {
                                    val step = maxOf(1, history.size / 5)
                                    if (idx % step == 0 || idx == history.size - 1) {
                                        try {
                                            val cleanStr = history[idx].recordedAt.substringBefore(".").removeSuffix("Z")
                                            val date = isoFormatter.parse(cleanStr)
                                            date?.let { displayFormatter.format(it) } ?: ""
                                        } catch (e: Exception) { "" }
                                    } else ""
                                } else ""
                            }
                        ),
                        modifier = Modifier.height(180.dp)
                    )
                }
            }

            // 4. Solar Voltage
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f)),
                elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "SOLAR VOLTAGE (V)",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold
                        )
                        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(8.dp)) {
                            Text(
                                "Now: ${String.format(Locale.US, "%.2f", sensorData.solarVoltage)}V",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    Chart(
                        chart = lineChart(),
                        model = voltageChartEntryModel,
                        startAxis = rememberStartAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp)
                        ),
                        bottomAxis = rememberBottomAxis(
                            label = textComponent(color = labelColor, textSize = 10.sp),
                            axis = lineComponent(color = lineColor, thickness = 1.dp),
                            guideline = lineComponent(color = guideColor, thickness = 1.dp),
                            valueFormatter = { value, _ -> 
                                val idx = value.toInt()
                                if (idx in history.indices) {
                                    val step = maxOf(1, history.size / 5)
                                    if (idx % step == 0 || idx == history.size - 1) {
                                        try {
                                            val cleanStr = history[idx].recordedAt.substringBefore(".").removeSuffix("Z")
                                            val date = isoFormatter.parse(cleanStr)
                                            date?.let { displayFormatter.format(it) } ?: ""
                                        } catch (e: Exception) { "" }
                                    } else ""
                                } else ""
                            }
                        ),
                        modifier = Modifier.height(180.dp)
                    )
                }
            }
            
            // 5. Sunlight Distribution & Cleaning Summary
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                // Sunlight
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "SUNLIGHT", 
                            style = MaterialTheme.typography.labelSmall, 
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        val total = (strongSun + mediumSun + weakSun).coerceAtLeast(1)
                        Text("Strong: ${strongSun * 100 / total}%", style = MaterialTheme.typography.bodyMedium)
                        Text("Medium: ${mediumSun * 100 / total}%", style = MaterialTheme.typography.bodyMedium)
                        Text("Weak: ${weakSun * 100 / total}%", style = MaterialTheme.typography.bodyMedium)
                    }
                }
                
                // Operations
                Card(
                    modifier = Modifier.weight(1f),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.1f))
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            "OPERATIONS", 
                            style = MaterialTheme.typography.labelSmall, 
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("Cleanings: $cleaningCycles", style = MaterialTheme.typography.bodyMedium)
                        val rainPct = rainBlocks * 100 / history.size.coerceAtLeast(1)
                        Text("Rain Block: $rainPct%", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
    }
}
