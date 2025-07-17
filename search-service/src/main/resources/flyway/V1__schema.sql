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
