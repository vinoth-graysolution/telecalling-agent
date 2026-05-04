-- ============================================================
-- Migration: Whitepoint Dental Studio — doctor-aware schema
-- Run this against your PostgreSQL database (AWS RDS)
-- ============================================================

-- 1. Add doctor / reason / patient_type columns to appointments
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS doctor            TEXT DEFAULT 'Dr. Anjali Rao',
    ADD COLUMN IF NOT EXISTS reason            TEXT,
    ADD COLUMN IF NOT EXISTS patient_type      TEXT DEFAULT 'NEW',
    ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;   -- Google Calendar event ID

-- 2. Create patients CRM table (for create_patient_record tool)
CREATE TABLE IF NOT EXISTS patients (
    id              SERIAL PRIMARY KEY,
    name            TEXT        NOT NULL,
    phone           TEXT        NOT NULL UNIQUE,
    patient_type    TEXT        NOT NULL DEFAULT 'NEW',
    last_complaint  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- 3. Front-desk notification log
--    Written by book_slot so reception sees upcoming new-patient arrivals.
CREATE TABLE IF NOT EXISTS front_desk_notifications (
    id               SERIAL PRIMARY KEY,
    appointment_id   INTEGER REFERENCES appointments(id) ON DELETE CASCADE,
    patient_name     TEXT        NOT NULL,
    appointment_date DATE        NOT NULL,
    appointment_time TIME        NOT NULL,
    doctor           TEXT        NOT NULL,
    patient_type     TEXT        NOT NULL DEFAULT 'NEW',
    notified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged     BOOLEAN     NOT NULL DEFAULT FALSE
);

-- 4. Index for fast doctor-based slot lookups
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
    ON appointments (doctor, appointment_date);

-- 5. Index for patient phone lookups
CREATE INDEX IF NOT EXISTS idx_patients_phone
    ON patients (phone);

-- 6. Index for front-desk dashboard (today's unacknowledged notifications)
CREATE INDEX IF NOT EXISTS idx_fdn_date_ack
    ON front_desk_notifications (appointment_date, acknowledged);

-- Verify
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_name = 'appointments'
ORDER  BY ordinal_position;
