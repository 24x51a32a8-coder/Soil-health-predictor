-- ============================================
-- Soil Health Predictor Database Schema (Neon PostgreSQL)
-- Run this once against your Neon database:
--   psql "$DATABASE_URL" -f schema.sql
-- or paste it into the Neon SQL Editor.
-- ============================================

CREATE TABLE IF NOT EXISTS farmers (
    id                SERIAL PRIMARY KEY,
    full_name         VARCHAR(120) NOT NULL,
    phone             VARCHAR(20)  NOT NULL UNIQUE,
    email             VARCHAR(150) NOT NULL UNIQUE,
    village           VARCHAR(120) NOT NULL,
    password_hash     TEXT NOT NULL,
    reset_token       TEXT,
    reset_token_expiry TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
    id                SERIAL PRIMARY KEY,
    farmer_id         INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    source            VARCHAR(20) NOT NULL DEFAULT 'manual', -- 'manual' or 'ocr'
    village           VARCHAR(120),
    latitude          DOUBLE PRECISION,
    longitude         DOUBLE PRECISION,
    land_area         NUMERIC,
    water_availability VARCHAR(50),
    temperature       NUMERIC,
    humidity          NUMERIC,
    rainfall          NUMERIC,
    soil_data         JSONB NOT NULL,      -- { ph, ec, oc, n, p, k, s, zn, b, fe, mn, cu }
    soil_status       JSONB NOT NULL,      -- { ph: 'normal', n: 'low', ... }
    soil_health_score  INTEGER NOT NULL,
    solutions         JSONB NOT NULL,      -- array of nutrient solution objects
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
    id                SERIAL PRIMARY KEY,
    farmer_id         INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    prediction_id     INTEGER REFERENCES predictions(id) ON DELETE SET NULL,
    file_name         VARCHAR(255) NOT NULL,
    file_type         VARCHAR(20) NOT NULL,
    extracted_text    TEXT,
    uploaded_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feedback (
    id                SERIAL PRIMARY KEY,
    farmer_id         INTEGER REFERENCES farmers(id) ON DELETE SET NULL,
    name              VARCHAR(120),
    email             VARCHAR(150),
    message           TEXT NOT NULL,
    rating            INTEGER,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_logs (
    id                SERIAL PRIMARY KEY,
    farmer_id         INTEGER REFERENCES farmers(id) ON DELETE SET NULL,
    question          TEXT NOT NULL,
    answer            TEXT NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_farmer ON predictions(farmer_id);
CREATE INDEX IF NOT EXISTS idx_reports_farmer ON reports(farmer_id);
