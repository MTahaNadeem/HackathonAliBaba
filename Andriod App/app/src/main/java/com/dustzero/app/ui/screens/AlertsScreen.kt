package com.dustzero.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.dustzero.app.data.AlertEntity
import com.dustzero.app.ui.theme.DangerRed
import com.dustzero.app.ui.theme.PrimaryGreen
import com.dustzero.app.ui.theme.WarningAmber
import com.dustzero.app.viewmodel.MainViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun AlertsScreen(viewModel: MainViewModel) {
    val dbAlerts by viewModel.alerts.collectAsStateWithLifecycle()

    // Fallback mock alerts shown when the DB is empty (first run / demo)
    val mockAlerts = remember {
        listOf(
            AlertEntity(
                id = -1, type = "WARNING", severity = "WARNING",
                message = "LOW SOLAR OUTPUT - Solar output is lower than expected for current sunlight.",
                timestamp = System.currentTimeMillis() - 60_000, read = false
            ),
            AlertEntity(
                id = -2, type = "INFO", severity = "INFO",
                message = "CLEANING COMPLETED - Cleaning cycle completed successfully.",
                timestamp = System.currentTimeMillis() - 3_600_000, read = false
            ),
            AlertEntity(
                id = -3, type = "SYSTEM", severity = "CRITICAL",
                message = "RAIN DETECTED - Automatic cleaning is temporarily blocked for panel protection.",
                timestamp = System.currentTimeMillis() - 7_200_000, read = true
            )
        )
    }

    val alerts = if (dbAlerts.isEmpty()) mockAlerts else dbAlerts
    val unreadCount = alerts.count { !it.read }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // ── Header ───────────────────────────────────────────────────────────
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column {
                    Text(
                        text = "System Alerts",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = if (unreadCount > 0) "$unreadCount unread notification${if (unreadCount > 1) "s" else ""}"
                        else "All caught up",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Mark all read — tonal button for proper tap target
                if (unreadCount > 0) {
                    FilledTonalButton(
                        onClick = {
                            alerts.filter { !it.read }.forEach { alert ->
                                if (alert.id > 0) viewModel.markAlertRead(alert.id)
                            }
                        },
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = "Mark all read",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.08f))

        // ── Alert List / Empty State ─────────────────────────────────────────
        if (alerts.isEmpty()) {
            // Empty state
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(40.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Rounded.NotificationsNone,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                        modifier = Modifier.size(72.dp)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "No alerts right now",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "System events, warnings, and notifications\nwill appear here.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            LazyColumn(
                contentPadding = PaddingValues(
                    start = 20.dp,
                    top = 16.dp,
                    end = 20.dp,
                    bottom = 32.dp
                ),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(alerts, key = { it.id }) { alert ->
                    AlertCard(
                        alert = alert,
                        onMarkRead = {
                            if (alert.id > 0) viewModel.markAlertRead(alert.id)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun AlertCard(alert: AlertEntity, onMarkRead: () -> Unit) {
    val severity = alert.severity.uppercase()
    val (icon, accentColor) = when (severity) {
        "CRITICAL", "DANGER", "SYSTEM" -> Pair(Icons.Rounded.Error, DangerRed)
        "WARNING" -> Pair(Icons.Rounded.Warning, WarningAmber)
        else -> Pair(Icons.Rounded.Info, MaterialTheme.colorScheme.secondary)
    }

    // Split "TITLE - description" format into two parts
    val separatorIndex = alert.message.indexOf(" - ")
    val title = if (separatorIndex > 0) alert.message.substring(0, separatorIndex) else alert.severity
    val description = if (separatorIndex > 0) alert.message.substring(separatorIndex + 3) else alert.message

    val timestampText = remember(alert.timestamp) { formatTimestamp(alert.timestamp) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !alert.read, onClick = onMarkRead)
            .drawBehind {
                // Colored left accent bar — the only strong perimeter indicator
                drawLine(
                    color = accentColor,
                    start = Offset(0f, 14.dp.toPx()),
                    end = Offset(0f, size.height - 14.dp.toPx()),
                    strokeWidth = 4.dp.toPx()
                )
            },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(
            // Unread: soft accent tint. Read: plain surface — no border on either.
            containerColor = if (alert.read)
                MaterialTheme.colorScheme.surface
            else
                accentColor.copy(alpha = 0.09f)
        ),
        // Soft shadow gives card depth; no visible outline border
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (alert.read) 1.dp else 3.dp
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Severity icon badge
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(accentColor.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = severity,
                    tint = accentColor,
                    modifier = Modifier.size(22.dp)
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                // Severity label chip
                Text(
                    text = severity,
                    style = MaterialTheme.typography.labelSmall,
                    color = accentColor,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp
                )
                Spacer(modifier = Modifier.height(3.dp))
                // Bold title
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (alert.read) FontWeight.SemiBold else FontWeight.Bold,
                    color = if (alert.read)
                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f)
                    else
                        MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(4.dp))
                // Lighter description
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.Normal,
                    lineHeight = 18.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = timestampText,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                )
            }

            // Unread dot indicator
            if (!alert.read) {
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .size(9.dp)
                        .clip(CircleShape)
                        .background(accentColor)
                        .align(Alignment.Top)
                )
            }
        }
    }
}

private fun formatTimestamp(ts: Long): String {
    val diff = System.currentTimeMillis() - ts
    return when {
        diff < 60_000 -> "Just now"
        diff < 3_600_000 -> "${diff / 60_000}m ago"
        diff < 86_400_000 -> "${diff / 3_600_000}h ago"
        else -> SimpleDateFormat("MMM d, HH:mm", Locale.getDefault()).format(Date(ts))
    }
}
