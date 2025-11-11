CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';

CREATE TABLE doi
(
    id                      bigint                            NOT NULL,
    uuid                    uuid    DEFAULT gen_random_uuid() NOT NULL,
    doi                     citext                            NOT NULL,
    title                   text                              NOT NULL,
    authors                 text                              NOT NULL,
    description             text                              NOT NULL,
    date_minted             timestamp without time zone       NOT NULL,
    provider                text                              NOT NULL,
    filename                text,
    content_type            text,
    provider_metadata       jsonb                             NOT NULL,
    application_metadata    jsonb,
    custom_landing_page_url text,
    application_url         text,
    version                 bigint                            NOT NULL,
    date_created            timestamp without time zone       NOT NULL,
    last_updated            timestamp without time zone       NOT NULL,
    file_hash               bytea,
    file_size               bigint,
    licence                 text[],
    user_id                 text,
    active                  boolean DEFAULT true              NOT NULL,
    authorised_roles        text[],
    display_template        text
);

ALTER TABLE ONLY doi ADD CONSTRAINT doi_doi_key UNIQUE (doi);
ALTER TABLE ONLY doi ADD CONSTRAINT doi_pkey PRIMARY KEY (id);
ALTER TABLE ONLY doi ADD CONSTRAINT doi_uuid_key UNIQUE (uuid);
CREATE INDEX doi_doi_idx ON doi USING btree (doi);
CREATE INDEX doi_uuid_idx ON doi USING btree (uuid);
