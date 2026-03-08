-- Audit history for admin-mutated entities (config, banner, dq)

CREATE TABLE IF NOT EXISTS audit_history
(
    id           BIGSERIAL                NOT NULL,
    entity_table VARCHAR(64)              NOT NULL,
    entity_id    VARCHAR(255)             NOT NULL,
    entity_name  VARCHAR(255),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actor        VARCHAR(255),
    action       VARCHAR(16)              NOT NULL,
    diff         TEXT,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_audit_entity_table ON audit_history (entity_table);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id    ON audit_history (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at   ON audit_history (created_at DESC);

