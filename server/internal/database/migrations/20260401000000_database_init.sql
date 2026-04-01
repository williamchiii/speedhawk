-- +goose Up
CREATE TABLE IF NOT EXISTS audits (
    id SERIAL PRIMARY KEY,
    url VARCHAR(2048) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    score INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    ttfb INTEGER,
    fcp INTEGER,
    lcp INTEGER,
    bundle_size INTEGER
);

CREATE TABLE IF NOT EXISTS suggestions (
    id SERIAL PRIMARY KEY,
    audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    impact VARCHAR(20) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_audit_id ON metrics(audit_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_audit_id ON suggestions(audit_id);

-- +goose Down
DROP TABLE IF EXISTS suggestions;
DROP TABLE IF EXISTS metrics;
DROP TABLE IF EXISTS audits;