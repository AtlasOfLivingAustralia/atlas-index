CREATE TABLE dqprofile
(
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    data JSONB        NOT NULL
);

CREATE INDEX idx_dqprofile_name ON dqprofile (name);
