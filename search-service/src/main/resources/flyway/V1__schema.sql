CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE dqprofile
(
    id            BIGSERIAL PRIMARY KEY,
    short_name    VARCHAR(255) NOT NULL,
    name          VARCHAR(255),
    description   TEXT,
    contact_name  VARCHAR(255),
    contact_email VARCHAR(255),
    enabled       BOOLEAN   DEFAULT FALSE,
    is_default    BOOLEAN   DEFAULT FALSE,
    display_order BIGINT    DEFAULT 0,
    date_created  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    categories    JSONB        NOT NULL
);

CREATE INDEX idx_dqprofile_name ON dqprofile (short_name);

CREATE TABLE config
(
    id      VARCHAR(255) PRIMARY KEY,
    updated TIMESTAMP,
    value   TEXT,
    notes   TEXT
);

CREATE TABLE queue
(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        VARCHAR(255) NOT NULL,
    created        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started        TIMESTAMPTZ DEFAULT NULL,
    liveness       TIMESTAMPTZ DEFAULT NULL,
    status         VARCHAR(10) NOT NULL,
    status_message TEXT DEFAULT NULL,
    queue_request  JSONB NOT NULL
);

CREATE INDEX idx_queue_user_id ON queue (user_id);

CREATE INDEX idx_queue_status ON queue (status);

CREATE INDEX idx_queue_tasktype ON queue ((queue_request->>'taskType'));

CREATE INDEX idx_queue_email ON queue ((queue_request->>'email'));
