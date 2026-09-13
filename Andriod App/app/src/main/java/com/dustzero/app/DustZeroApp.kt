package com.dustzero.app

import android.app.Application

/**
 * DustZero Application class.
 *
 * Registered in AndroidManifest.xml as the application-level class.
 * Use this class for any one-time global initialization:
 * - Dependency injection setup
 * - Logging configuration
 * - Crash reporting
 * - Global SDK initialization
 */
class DustZeroApp : Application() {

    override fun onCreate() {
        super.onCreate()
        // Add global initialization here in the future.
        // Example: Timber.plant(Timber.DebugTree())
    }
}
