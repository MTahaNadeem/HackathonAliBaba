# DustZero — Smart Solar Panel Cleaning System

An Android application for monitoring and controlling an ESP32-S3 based automatic solar panel cleaning system. Built with **Kotlin + Jetpack Compose** and connected to **Supabase** for real-time cloud communication.

---

## Architecture

```
ESP32-S3 → Wi-Fi → Supabase (Realtime) → DustZero Android App
DustZero App → Supabase (commands table) → ESP32-S3 → L298N → Stepper Motor
```

The Android app **never directly controls ESP32 GPIOs**. All communication goes through the Supabase cloud backend.

---

## Current Schema Limitations

> These are **intentional** constraints of the v1 schema — not bugs. Each can be added in a future migration without rewriting the service layer.

| Feature | Status | Notes |
|---------|--------|-------|
| **`alerts` table** | ❌ Not in schema | Alerts are generated **client-side** in `SupabaseIotService` by watching Realtime state changes (rain, fault, offline, cleaning completed) and inserting into the local Room database. To replace: add a `device_alerts` table, subscribe to it, and remove `generateAlertsForStateChange()` from the service. |
| **`device_history` table** | ❌ Not in schema | Analytics charts (24H/7D/30D) use **static mock data**. The service layer is structured so a `HistoryService` can be added later to query a time-series table without touching existing screens. |
| **Online detection** | ⚠ Heartbeat-based | The app does **not** rely solely on `devices.connected`. It also checks that `devices.updated_at` was within the last 30 seconds. If the ESP32 crashes without clearing `connected`, the app will show "Offline" within 30s automatically. |

---

## Requirements

| Tool | Version |
|------|---------|
| **Android Studio** | Hedgehog (2023.1.1) or newer |
| **Android SDK** | API 36 (compile), API 24 minimum |
| **JDK** | 11 or newer (bundled with Android Studio) |
| **Gradle** | Managed automatically by the wrapper |

> You do **not** need Node.js. This is a native Android project.

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/DustZero.git
cd DustZero
```

### 2. Configure environment variables

```bash
# Copy the example file
cp .env.example .env
```

Open `.env` and fill in your real Supabase credentials:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Get your keys**: Supabase Dashboard → Your Project → Settings → API
> 
> Use the **anon** public key. Do NOT put the service_role key in the app.

### 3. Set up Supabase (first time)

Run the SQL in `SUPABASE_SCHEMA.sql` in your Supabase project:

1. Go to [supabase.com](https://supabase.com) → Your Project → SQL Editor
2. Paste the contents of `SUPABASE_SCHEMA.sql`
3. Click **Run**

### 4. Open in Android Studio

1. Open Android Studio
2. Click **File → Open**
3. Select the `DustZero` root folder
4. Wait for Gradle sync to complete (~1-2 minutes first time)

> **Important**: Android Studio must read your `.env` file for Supabase credentials. Make sure `.env` is present before building.

---

## Running the App

### Run on a physical Android phone (recommended)

1. Enable **Developer Options** on your phone:
   - Go to Settings → About Phone → tap **Build Number** 7 times
2. Enable **USB Debugging** in Developer Options
3. Connect your phone via USB cable
4. In Android Studio, select your device from the device dropdown
5. Click the **▶ Run** button (or press `Shift+F10`)

### Without real Supabase credentials

The app automatically enters **Demo Mode** if Supabase is not configured. You can:
- View simulated sensor data
- Trigger cleaning scenarios (NORMAL, DUST, CLOUDY, RAIN, OFFLINE)
- Test all 5 tabs and navigation

Enable Demo Mode: **Settings tab → Developer & Demo → Demo Mode**

---

## Building an APK

### Debug APK (for testing)

In Android Studio:
1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. APK is saved to `app/build/outputs/apk/debug/`

Or using the command line:

**Windows (PowerShell):**
```powershell
.\gradlew assembleDebug
```

**macOS/Linux:**
```bash
./gradlew assembleDebug
```

### Release APK (for distribution)

A release keystore is required. See [Android documentation on signing](https://developer.android.com/studio/publish/app-signing).

Set environment variables, then:
```powershell
$env:KEYSTORE_PATH="path/to/your-keystore.jks"
$env:STORE_PASSWORD="your-store-password"
$env:KEY_PASSWORD="your-key-password"
.\gradlew assembleRelease
```

---

## Project Structure

```
DustZero/
├── app/src/main/java/com/dustzero/app/
│   ├── DustZeroApp.kt          ← Application class
│   ├── MainActivity.kt         ← Entry point
│   │
│   ├── data/                   ← Room database (local storage)
│   │   ├── AppDao.kt           ← Database queries
│   │   ├── AppDatabase.kt      ← Room setup
│   │   ├── Entities.kt         ← Alert + CleaningHistory tables
│   │   └── ThemePreferences.kt ← Theme persistence (SharedPreferences)
│   │
│   ├── iot/                    ← Cloud/hardware communication layer
│   │   ├── IotService.kt       ← Service interface
│   │   ├── SupabaseIotService.kt ← Real Supabase implementation
│   │   ├── DemoIotService.kt   ← Demo/simulation fallback
│   │   └── SupabaseModels.kt   ← Supabase data transfer objects
│   │
│   ├── models/                 ← Data models
│   │   ├── AppConstants.kt     ← ⭐ Central config (device ID, table names, etc.)
│   │   └── Models.kt           ← SensorData, ThresholdConfig
│   │
│   ├── ui/
│   │   ├── Navigation.kt       ← Bottom navigation + NavHost
│   │   ├── components/         ← Reusable UI components
│   │   │   ├── MetricCard.kt   ← Sensor value card
│   │   │   └── StatusCard.kt   ← Status indicator card
│   │   ├── screens/            ← App screens
│   │   │   ├── DashboardScreen.kt
│   │   │   ├── AnalyticsScreen.kt
│   │   │   ├── CleaningScreen.kt
│   │   │   ├── AlertsScreen.kt
│   │   │   └── SettingsScreen.kt
│   │   └── theme/              ← ⭐ Theme system
│   │       ├── Color.kt        ← Brand colors
│   │       ├── Theme.kt        ← Light/Dark color schemes
│   │       └── Type.kt         ← Typography
│   │
│   └── viewmodel/
│       └── MainViewModel.kt    ← App state management
│
├── app/src/main/res/           ← Android resources (icons, strings, themes)
├── SUPABASE_SCHEMA.sql         ← Database schema to run in Supabase
├── .env.example                ← Environment variable template
└── README.md                   ← This file
```

---

## Customization

### Change the device ID

Edit [`AppConstants.kt`](app/src/main/java/com/dustzero/app/models/AppConstants.kt):

```kotlin
const val DEVICE_ID = "dustzero-001"  // ← change this
```

Also update the `SUPABASE_SCHEMA.sql` INSERT statement accordingly.

### Change the theme colors

Edit [`Color.kt`](app/src/main/java/com/dustzero/app/ui/theme/Color.kt):

```kotlin
val GreenPrimary = Color(0xFF10B981)   // ← primary brand color
val BlueAccent = Color(0xFF3B82F6)     // ← secondary accent
val OrangeSunlight = Color(0xFFF59E0B) // ← sunlight/warning color
```

### Change the app name

Edit `app/src/main/res/values/strings.xml`:

```xml
<string name="app_name">DustZero</string>
```

---

## ESP32 Integration (Future)

The ESP32-S3 should:
1. Connect to Wi-Fi
2. Write sensor readings to the `devices` table in Supabase
3. Poll the `commands` table for `PENDING` commands
4. Execute commands (START_CLEANING, STOP_CLEANING, HOME_MOTOR)
5. Mark commands as `COMPLETED` or `FAILED`

The Android app handles everything on the cloud side. No direct ESP32 ↔ Android communication is needed.

---

## Firebase Note

The project includes Firebase AI + AppCheck dependencies (from the AI Studio template). A `google-services.json` is **not required** — the build is configured to warn and continue if it's missing. If you don't need Firebase AI, these dependencies can be removed from `app/build.gradle.kts` in a future cleanup.

---

## Troubleshooting

**Gradle sync fails:**
- Make sure you have Android SDK installed
- Check that `local.properties` has the correct `sdk.dir` path

**App opens in Demo Mode instead of connecting:**
- Make sure your `.env` file exists and has real Supabase credentials (not the placeholder values from `.env.example`)
- Verify your Supabase project is running and the `devices` table exists

**APK build fails with signing error:**
- For debug builds, Android Studio auto-generates a debug keystore — this should work automatically
- For release builds, configure the keystore environment variables as described above

---

## License

MIT
