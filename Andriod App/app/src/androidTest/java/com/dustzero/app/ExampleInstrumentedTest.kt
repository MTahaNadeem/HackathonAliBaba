package com.dustzero.app

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented test, which will execute on an Android device.
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
@RunWith(AndroidJUnit4::class)
class ExampleInstrumentedTest {
    @Test
    fun useAppContext() {
        // Verifies the app package name matches the configured applicationId
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.dustzero.app", appContext.packageName)
    }
}
