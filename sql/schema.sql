-- Discord Whitelist System with Admin Dashboard & Global Key
-- PostgreSQL Production Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$ BEGIN
    CREATE TYPE key_tier AS ENUM ('free', 'basic', 'premium', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE key_status AS ENUM ('active', 'revoked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE log_action AS ENUM (
        'KEY_CREATED',
        'KEY_REVOKED',
        'KEY_REDEEMED',
        'HWID_RESET',
        'GLOBAL_KEY_TOGGLED',
        'SETTINGS_UPDATED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Keys Table (Supports both individual keys and Global Key)
CREATE TABLE IF NOT EXISTS keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(16) NOT NULL,
    tier key_tier NOT NULL DEFAULT 'premium',
    status key_status NOT NULL DEFAULT 'active',
    is_global BOOLEAN NOT NULL DEFAULT FALSE,
    discord_id VARCHAR(20) NULL,
    max_clients INT NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NULL,
    created_by VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    note TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keys_hash ON keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_keys_discord_id ON keys(discord_id) WHERE discord_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_keys_status ON keys(status);
CREATE INDEX IF NOT EXISTS idx_keys_is_global ON keys(is_global) WHERE is_global = TRUE;

-- 2. Key Bindings (Installation / Client identifiers)
CREATE TABLE IF NOT EXISTS key_bindings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
    client_id_hash VARCHAR(64) NOT NULL,
    client_label VARCHAR(64) NULL,
    first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_key_client UNIQUE (key_id, client_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_bindings_key_id ON key_bindings(key_id);
CREATE INDEX IF NOT EXISTS idx_bindings_client_hash ON key_bindings(client_id_hash);

-- 3. Verification Logs
CREATE TABLE IF NOT EXISTS verification_logs (
    id BIGSERIAL PRIMARY KEY,
    key_id UUID NULL REFERENCES keys(id) ON DELETE SET NULL,
    key_prefix VARCHAR(16) NULL,
    client_id_hash VARCHAR(64) NOT NULL,
    ip_hash VARCHAR(64) NULL,
    tier VARCHAR(20) NOT NULL,
    success BOOLEAN NOT NULL,
    reason VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verif_logs_created_at ON verification_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verif_logs_key_id ON verification_logs(key_id);

-- 4. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(64) NOT NULL,
    action log_action NOT NULL,
    target_id VARCHAR(64) NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 5. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default global key settings
INSERT INTO system_settings (key, value)
VALUES (
    'global_key',
    '{"enabled": true, "key": "GLOBAL-FREE-2026", "tier": "free", "features": ["basic"], "max_clients": 999999}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
