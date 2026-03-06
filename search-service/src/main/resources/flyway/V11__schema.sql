-- Banner table for per-section UI banner messages

CREATE TABLE IF NOT EXISTS banner
(
    section  VARCHAR(64)              NOT NULL,
    message  TEXT                     NOT NULL DEFAULT '',
    severity VARCHAR(16)              NOT NULL DEFAULT 'INFO',
    updated  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (section)
);

