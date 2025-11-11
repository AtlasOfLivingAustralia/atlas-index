-- Enable pgcrypto extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE signed_url
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expires_at BIGINT      NOT NULL,
    blob       JSONB       NOT NULL
);
