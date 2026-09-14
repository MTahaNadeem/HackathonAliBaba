-- Migration: Create device_history table and auto-snapshot mechanism
-- Run this in your Supabase SQL Editor

-- 1. Create the device_history table
CREATE TABLE IF NOT EXISTS public.device_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id text NOT NULL,
    recorded_at timestamptz DEFAULT now(),
    solar_power numeric,
    solar_voltage numeric,
    solar_current numeric,
    temperature numeric,
    ldr1 integer,
    ldr2 integer,
    sunlight_level text,
    rain_detected boolean,
    cleaning_state text
);

-- 2. Enable Realtime on device_history
-- (Useful if Analytics screen ever wants live-updating charts)
ALTER PUBLICATION supabase_realtime ADD TABLE public.device_history;

-- 3. Set up RLS (Row Level Security)
ALTER TABLE public.device_history ENABLE ROW LEVEL SECURITY;

-- Allow anonymous select for the app to read data
CREATE POLICY "Enable read access for all users"
ON public.device_history FOR SELECT USING (true);

-- 4. Enable pg_cron (requires superuser, which Supabase provides by default)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 5. Schedule the snapshot job to run every 5 minutes
-- This copies the current row from `devices` into `device_history`
SELECT cron.schedule(
  'snapshot_device_history_every_5m',
  '*/5 * * * *',
  $$
    INSERT INTO public.device_history (
        device_id, solar_power, solar_voltage, solar_current, temperature,
        ldr1, ldr2, sunlight_level, rain_detected, cleaning_state
    )
    SELECT
        device_id, solar_power, solar_voltage, solar_current, temperature,
        ldr1, ldr2, sunlight_level, rain_detected, cleaning_state
    FROM public.devices
    WHERE connected = true AND updated_at >= now() - interval '20 seconds';
  $$
);
