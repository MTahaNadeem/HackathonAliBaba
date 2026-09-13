package com.dustzero.app.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightColors = lightColorScheme(
    primary = PrimaryGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD1FAE5),
    onPrimaryContainer = CharcoalDark,
    secondary = SecondaryBlue,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFDBEAFE),
    onSecondaryContainer = CharcoalDark,
    tertiary = WarningAmber,
    onTertiary = Color.White,
    error = DangerRed,
    onError = Color.White,
    errorContainer = Color(0xFFFEE2E2),
    onErrorContainer = Color(0xFF991B1B),
    background = OffWhite,
    onBackground = CharcoalDark,
    surface = CardWhite,
    onSurface = CharcoalDark,
    surfaceVariant = Color(0xFFF3F4F6),
    onSurfaceVariant = CharcoalLight,
    outline = Color(0xFFD1D5DB)
)

private val DarkColors = darkColorScheme(
    primary = PrimaryGreen,
    onPrimary = CharcoalDark,
    primaryContainer = Color(0xFF065F46),
    onPrimaryContainer = Color(0xFFD1FAE5),
    secondary = SecondaryBlue,
    onSecondary = CharcoalDark,
    secondaryContainer = Color(0xFF1E40AF),
    onSecondaryContainer = Color(0xFFDBEAFE),
    tertiary = WarningAmber,
    onTertiary = CharcoalDark,
    error = Color(0xFFF87171),
    onError = CharcoalDark,
    errorContainer = Color(0xFF991B1B),
    onErrorContainer = Color(0xFFFEE2E2),
    background = DarkBackground,
    onBackground = TextOffWhite,
    surface = DarkCard,
    onSurface = TextOffWhite,
    surfaceVariant = Color(0xFF334155),
    onSurfaceVariant = TextMutedGray,
    outline = Color(0xFF475569)
)

@Composable
fun AppTheme(
    useDarkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Disabled — consistent DustZero brand look
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val colors = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            if (useDarkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        useDarkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colors,
        typography = Typography,
        content = content
    )
}
