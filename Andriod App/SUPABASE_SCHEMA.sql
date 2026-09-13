-- =============================================================================
-- DustZero — Supabase Database Schema
-- Smart Solar Panel Cleaning System
-- =============================================================================
--
-- Run this SQL in your Supabase project:
--   Dashboard → SQL Editor → Paste → Run
--
-- Architecture:
--   ESP32-S3 → Wi-Fi → Supabase (devices table) → Realtime → Android App
--   Android App → Supabase (commands table) → ESP32-S3 → L298N → Stepper Motor
--
-- =============================================================================

-- 1. Devices table — ESP32 writes its sensor data here
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    connected BOOLEAN DEFAULT false,
    ldr1 INTEGER DEFAULT 0,
    ldr2 INTEGER DEFAULT 0,
    temperature NUMERIC DEFAULT 0.0,
    solar_voltage NUMERIC DEFAULT 0.0,
    solar_current NUMERIC DEFAULT 0.0,
    solar_power NUMERIC DEFAULT 0.0,
    rain_detected BOOLEAN DEFAULT false,
    sun_detected BOOLEAN DEFAULT false,
    sunlight_level TEXT DEFAULT 'WEAK',
    cleaning_state TEXT DEFAULT 'IDLE',
    cleaning_progress INTEGER DEFAULT 0,
    cleaning_steps INTEGER DEFAULT 0,
    fault BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Commands table — App writes commands here; ESP32 polls and executes them
CREATE TABLE commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT REFERENCES devices(device_id),
    command TEXT NOT NULL,        -- START_CLEANING | STOP_CLEANING | HOME_MOTOR
    status TEXT DEFAULT 'PENDING', -- PENDING | ACKNOWLEDGED | COMPLETED | FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable Realtime subscriptions for live updates in the Android app
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
ALTER PUBLICATION supabase_realtime ADD TABLE commands;

-- 4. Create the initial DustZero device record
--    Update 'dustzero-001' if your device uses a different ID
INSERT INTO devices (device_id, connected)
VALUES ('dustzero-001', false)
ON CONFLICT DO NOTHING;
