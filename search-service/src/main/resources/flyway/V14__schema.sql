-- Add closable flag to banner table

ALTER TABLE banner
    ADD COLUMN IF NOT EXISTS closable BOOLEAN NOT NULL DEFAULT TRUE;

