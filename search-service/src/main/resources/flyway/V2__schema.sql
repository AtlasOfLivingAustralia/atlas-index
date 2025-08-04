CREATE TABLE userdata
(
    userId varchar(255) NOT NULL,
    key    varchar(255) NOT NULL,
    value  text,
    PRIMARY KEY (userId, key)
);

CREATE INDEX idx_userdata_userid ON userdata (userId);
