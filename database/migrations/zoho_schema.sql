-- Migration for Zoho CRM Integration

CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) UNIQUE, -- 'zoho_crm'
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMP,
    config JSONB, -- stores client_id, client_secret, domain, etc.
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add external_id to patients to link with Zoho
ALTER TABLE patients ADD COLUMN IF NOT EXISTS external_id VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
