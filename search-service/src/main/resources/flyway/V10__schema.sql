-- For logger-service functionality

--
-- Table structure for table event_summary_breakdown_email
--

CREATE TABLE IF NOT EXISTS event_summary_breakdown_email
(
    month               varchar(255) NOT NULL,
    log_event_type_id   int          NOT NULL,
    user_email_category varchar(255) NOT NULL,
    number_of_events    bigint DEFAULT NULL,
    record_count        bigint DEFAULT NULL,
    PRIMARY KEY (month, log_event_type_id, user_email_category)
);

--
-- Table structure for table event_summary_breakdown_email_entity
--

CREATE TABLE IF NOT EXISTS event_summary_breakdown_email_entity
(
    month               varchar(255) NOT NULL,
    log_event_type_id   int          NOT NULL,
    user_email_category varchar(255) NOT NULL,
    entity_uid          varchar(255) NOT NULL,
    number_of_events    bigint DEFAULT NULL,
    record_count        bigint DEFAULT NULL,
    PRIMARY KEY (month, log_event_type_id, user_email_category, entity_uid)
);

--
-- Table structure for table event_summary_breakdown_reason
--

CREATE TABLE IF NOT EXISTS event_summary_breakdown_reason
(
    month              varchar(255) NOT NULL,
    log_event_type_id  int          NOT NULL,
    log_reason_type_id int          NOT NULL DEFAULT -1,
    number_of_events   bigint       NOT NULL,
    record_count       bigint       NOT NULL,
    PRIMARY KEY (month, log_event_type_id, log_reason_type_id)
);

--
-- Table structure for table event_summary_breakdown_reason_entity
--

CREATE TABLE IF NOT EXISTS event_summary_breakdown_reason_entity
(
    month              varchar(255) NOT NULL,
    log_event_type_id  int          NOT NULL,
    log_reason_type_id int          NOT NULL DEFAULT -1,
    entity_uid         varchar(255) NOT NULL,
    number_of_events   bigint       NOT NULL,
    record_count       bigint       NOT NULL,
    PRIMARY KEY (month, log_event_type_id, log_reason_type_id, entity_uid)
);

--
-- Table structure for table event_summary_breakdown_reason_entity_source
--

CREATE TABLE IF NOT EXISTS event_summary_breakdown_reason_entity_source
(
    month              varchar(255) NOT NULL,
    log_event_type_id  int          NOT NULL,
    log_reason_type_id int          NOT NULL DEFAULT -1,
    entity_uid         varchar(255) NOT NULL,
    log_source_type_id int          NOT NULL DEFAULT -1,
    number_of_events   bigint       NOT NULL,
    record_count       bigint       NOT NULL,
    PRIMARY KEY (month, log_event_type_id, log_reason_type_id, entity_uid, log_source_type_id)
);

--
-- Table structure for table event_summary_totals
--

CREATE TABLE IF NOT EXISTS event_summary_totals
(
    month             varchar(255) NOT NULL,
    log_event_type_id int          NOT NULL,
    number_of_events  bigint DEFAULT NULL,
    record_count      bigint DEFAULT NULL,
    PRIMARY KEY (month, log_event_type_id)
);

--
-- Table structure for table log_event
--

CREATE TABLE IF NOT EXISTS log_event
(
    id                 SERIAL PRIMARY KEY,
    comment            text,
    created            timestamp    DEFAULT NULL,
    log_event_type_id  int          DEFAULT NULL,
    month              varchar(255) DEFAULT NULL,
    user_email         varchar(255) DEFAULT NULL,
    user_ip            varchar(255) DEFAULT NULL,
    source             varchar(255) DEFAULT NULL,
    user_agent         varchar(255) DEFAULT NULL,
    log_reason_type_id int          DEFAULT NULL,
    log_source_type_id int          DEFAULT NULL,
    source_url         text
);

CREATE INDEX IF NOT EXISTS SUMMARYINDEX1 ON log_event (id, month, log_event_type_id, log_reason_type_id);
CREATE INDEX IF NOT EXISTS SUMMARYINDEX2 ON log_event (id, month, log_event_type_id);

--
-- Table structure for table log_event_type
--

CREATE TABLE IF NOT EXISTS log_event_type
(
    id   int NOT NULL,
    name varchar(255) DEFAULT NULL,
    PRIMARY KEY (id)
);

--
-- Table structure for table log_reason_type
--

CREATE TABLE IF NOT EXISTS log_reason_type
(
    id            int NOT NULL,
    rkey          varchar(255) DEFAULT NULL,
    name          varchar(255) DEFAULT NULL,
    default_order int          DEFAULT NULL,
    is_deprecated smallint     DEFAULT NULL,
    PRIMARY KEY (id)
);

--
-- Table structure for table log_source_type
--

CREATE TABLE IF NOT EXISTS log_source_type
(
    id   int NOT NULL,
    name varchar(255) DEFAULT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS log_detail
(
    id           SERIAL PRIMARY KEY,
    entity_type  varchar(255) DEFAULT NULL,
    entity_uid   varchar(255) DEFAULT NULL,
    record_count bigint       DEFAULT NULL,
    log_event_id int,
    FOREIGN KEY (log_event_id) REFERENCES log_event (id)
);

CREATE INDEX IF NOT EXISTS idx_log_detail_log_event_id ON log_detail (log_event_id);

CREATE INDEX IF NOT EXISTS esbee_entity_uid ON event_summary_breakdown_email_entity (entity_uid);
CREATE INDEX IF NOT EXISTS esbre_entity_uid ON event_summary_breakdown_reason_entity (entity_uid);

-- load initial data for log_event_type, log_reason_type and log_source_type tables
-- Can be changed post installation
-- INSERT INTO log_event_type (id, name)
-- VALUES (1000, 'OCCURRENCE_RECORDS_VIEWED'),
--        (1001, 'OCCURRENCE_RECORDS_VIEWED_ON_MAP'),
--        (1002, 'OCCURRENCE_RECORDS_DOWNLOADED'),
--        (2000, 'IMAGE_VIEWED');
--
-- INSERT INTO log_reason_type (id, rkey, name, default_order, is_deprecated)
-- VALUES (0, 'logger.download.reason.conservation', 'conservation management/planning', 400, 0),
--        (1, 'logger.download.reason.biosecurity', 'biosecurity management/planning', 100, 0),
--        (2, 'logger.download.reason.environmental', 'environmental assessment', 700, 0),
--        (3, 'logger.download.reason.education', 'education', 600, 0),
--        (4, 'logger.download.reason.research', 'scientific research', 1000, 0),
--        (5, 'logger.download.reason.collection.mgmt', 'collection management', 300, 0),
--        (6, 'logger.download.reason.other', 'other', 8000, 0),
--        (7, 'logger.download.reason.ecological.research', 'ecological research', 500, 0),
--        (8, 'logger.download.reason.systematic.research', 'systematic research/taxonomy', 1200, 0),
--        (9, 'logger.download.reason.other.scientific.research', 'other scientific research', 9900, 1),
--        (10, 'logger.download.reason.testing', 'testing', 9000, 0),
--        (11, 'logger.download.reason.citizen.science', 'citizen science', 200, 0),
--        (12, 'logger.download.reason.restoration.remediation', 'restoration/remediation', 900, 0),
--        (13, 'logger.download.reason.species.modelling', 'species modelling', 1300, 0);
--
-- INSERT INTO log_source_type (id, name)
-- VALUES (0, 'ALA'),
--        (1, 'OZCAM'),
--        (2, 'AVH'),
--        (3, 'OBIS'),
--        (4, 'ASBP'),
--        (5, 'AMRIN'),
--        (6, 'BVP'),
--        (7, 'TEPAPA'),
--        (2001, 'ALA4R'),
--        (2002, 'BCCVL'),
--        (2004, 'galah-R'),
--        (2005, 'galah-python'),
--        (2006, 'qgis-galah-python'),
--        (10000, 'Spatial Portal'),
--        (10001, 'List Tool'),
--        (10002, 'CSDM');

CREATE OR REPLACE PROCEDURE process_event_summary_breakdown_email(
    p_start_id BIGINT,
    p_end_id BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    DROP TABLE IF EXISTS tmp_aggregated_events;
    CREATE TEMP TABLE tmp_aggregated_events ON COMMIT DROP AS
    SELECT le.month,
           le.log_event_type_id,
           CASE
               WHEN le.user_email IS NULL OR le.user_email = '' THEN 'unspecified'
               WHEN le.user_email LIKE '%.edu%' THEN 'edu'
               WHEN le.user_email LIKE '%.ac.%' THEN 'edu'
               WHEN le.user_email LIKE '%.gov%' THEN 'gov'
               WHEN le.user_email LIKE '%csiro.au' THEN 'gov'
               ELSE 'other'
               END               AS user_email_category,
           COUNT(DISTINCT le.id) AS total_number_of_events
    FROM log_event le
             LEFT JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
    GROUP BY le.month, le.log_event_type_id, user_email_category;

    INSERT INTO event_summary_breakdown_email (month, log_event_type_id, user_email_category, number_of_events,
                                               record_count)
    SELECT month, log_event_type_id, user_email_category, total_number_of_events, 0
    FROM tmp_aggregated_events
    ON CONFLICT (month, log_event_type_id, user_email_category)
        DO UPDATE SET number_of_events = event_summary_breakdown_email.number_of_events + EXCLUDED.number_of_events;

    DROP TABLE IF EXISTS tmp_aggregated_events;

    DROP TABLE IF EXISTS tmp_sum_records;

    CREATE TEMP TABLE tmp_sum_records ON COMMIT DROP AS
    SELECT le.month,
           le.log_event_type_id,
           CASE
               WHEN le.user_email IS NULL OR le.user_email = '' THEN 'unspecified'
               WHEN le.user_email LIKE '%.edu%' THEN 'edu'
               WHEN le.user_email LIKE '%.ac.%' THEN 'edu'
               WHEN le.user_email LIKE '%.gov%' THEN 'gov'
               WHEN le.user_email LIKE '%csiro.au' THEN 'gov'
               ELSE 'other'
               END                           AS user_email_category,
           LEFT(ld.entity_uid, 2)            AS entity_prefix,
           COALESCE(SUM(ld.record_count), 0) AS total_record_count
    FROM log_event le
             LEFT JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
      AND LEFT(ld.entity_uid, 2) = 'dr'
    GROUP BY le.month, le.log_event_type_id, user_email_category, entity_prefix;

    UPDATE event_summary_breakdown_email est
    SET record_count = est.record_count + tmp.total_record_count
    FROM tmp_sum_records tmp
    WHERE est.month = tmp.month
      AND est.log_event_type_id = tmp.log_event_type_id
      AND est.user_email_category = tmp.user_email_category;

    DROP TABLE IF EXISTS tmp_sum_records;

    RAISE NOTICE 'COMPLETED: event_summary_breakdown_email % %', p_start_id, p_end_id;
END;
$$;

CREATE OR REPLACE PROCEDURE process_event_summary_breakdown_email_entity(
    p_start_id BIGINT,
    p_end_id BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    DROP TABLE IF EXISTS tmp_aggregated_results;
    CREATE TEMP TABLE tmp_aggregated_results ON COMMIT DROP AS
    SELECT le.month,
           le.log_event_type_id,
           CASE
               WHEN le.user_email IS NULL OR le.user_email = '' THEN 'unspecified'
               WHEN le.user_email LIKE '%.edu%' THEN 'edu'
               WHEN le.user_email LIKE '%.ac.%' THEN 'edu'
               WHEN le.user_email LIKE '%.gov%' THEN 'gov'
               WHEN le.user_email LIKE '%csiro.au' THEN 'gov'
               ELSE 'other'
               END                           AS user_email_category,
           ld.entity_uid,
           COUNT(ld.id)                      AS num_log_details,
           COALESCE(SUM(ld.record_count), 0) AS total_record_count
    FROM log_event le
             INNER JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
    GROUP BY le.month, le.log_event_type_id, user_email_category, ld.entity_uid;
    INSERT INTO event_summary_breakdown_email_entity (month, log_event_type_id, user_email_category, entity_uid,
                                                      number_of_events, record_count)
    SELECT month, log_event_type_id, user_email_category, entity_uid, num_log_details, total_record_count
    FROM tmp_aggregated_results
    ON CONFLICT (month, log_event_type_id, user_email_category, entity_uid)
        DO UPDATE SET number_of_events = event_summary_breakdown_email_entity.number_of_events +
                                         EXCLUDED.number_of_events,
                      record_count     = event_summary_breakdown_email_entity.record_count + EXCLUDED.record_count;
    DROP TABLE IF EXISTS tmp_aggregated_results;
    RAISE NOTICE 'COMPLETED: event_summary_breakdown_email_entity % %', p_start_id, p_end_id;
END;
$$;

CREATE OR REPLACE PROCEDURE process_event_summary_breakdown_reason(
    p_start_id BIGINT,
    p_end_id BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    RAISE NOTICE 'DEBUG: event_summary_breakdown_reason % %', p_start_id, p_end_id;

    DROP TABLE IF EXISTS tmp_log_event_summary;
    CREATE TEMP TABLE tmp_log_event_summary
    (
        month              TEXT,
        log_event_type_id  INT,
        log_reason_type_id INT,
        num_log_event      BIGINT
    ) ON COMMIT DROP;

    INSERT INTO tmp_log_event_summary (month, log_event_type_id, log_reason_type_id, num_log_event)
    SELECT le.month, le.log_event_type_id, COALESCE(le.log_reason_type_id, -1), COUNT(le.id)
    FROM log_event le
    WHERE le.id BETWEEN p_start_id AND p_end_id
      AND EXISTS (SELECT 1 FROM log_detail ld WHERE ld.log_event_id = le.id)
    GROUP BY le.month, le.log_event_type_id, le.log_reason_type_id;

    INSERT INTO event_summary_breakdown_reason (month, log_event_type_id, log_reason_type_id, number_of_events,
                                                record_count)
    SELECT month, log_event_type_id, log_reason_type_id, num_log_event, 0
    FROM tmp_log_event_summary
    ON CONFLICT (month, log_event_type_id, log_reason_type_id)
        DO UPDATE SET number_of_events = event_summary_breakdown_reason.number_of_events + EXCLUDED.number_of_events;

    DROP TABLE IF EXISTS tmp_aggregated_results;
    CREATE TEMP TABLE tmp_aggregated_results ON COMMIT DROP AS
    SELECT le.month,
           le.log_event_type_id,
           COALESCE(le.log_reason_type_id, -1) AS log_reason_type_id,
           LEFT(ld.entity_uid, 2)              AS entity_prefix,
           COALESCE(SUM(ld.record_count), 0)   AS total_record_count
    FROM log_event le
             LEFT JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
    GROUP BY le.month, le.log_event_type_id, le.log_reason_type_id, entity_prefix;

    UPDATE event_summary_breakdown_reason est
    SET record_count = est.record_count + tmp.total_record_count
    FROM tmp_aggregated_results tmp
    WHERE est.month = tmp.month
      AND est.log_event_type_id = tmp.log_event_type_id
      AND est.log_reason_type_id = tmp.log_reason_type_id
      AND tmp.entity_prefix = 'dr';


    RAISE NOTICE 'COMPLETED: event_summary_breakdown_reason % %', p_start_id, p_end_id;
END;
$$;

CREATE OR REPLACE PROCEDURE process_event_summary_breakdown_reason_entity(
    p_start_id BIGINT,
    p_end_id BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    RAISE NOTICE 'STARTED: event_summary_breakdown_reason_entity % %', p_start_id, p_end_id;

    DROP TABLE IF EXISTS tmp_log_event_summary;
    CREATE TEMP TABLE tmp_log_event_summary
    (
        month              TEXT,
        log_event_type_id  INT,
        log_reason_type_id INT,
        entity_uid         VARCHAR(10),
        num_log_event      BIGINT
    ) ON COMMIT DROP;

    INSERT INTO tmp_log_event_summary (month, log_event_type_id, log_reason_type_id, entity_uid, num_log_event)
    SELECT le.month,
           le.log_event_type_id,
           COALESCE(le.log_reason_type_id, -1) AS log_reason_type_id,
           ld.entity_uid,
           COUNT(DISTINCT le.id)               AS num_log_event
    FROM log_event le
             LEFT JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
      AND EXISTS (SELECT 1 FROM log_detail ld2 WHERE ld2.log_event_id = le.id)
    GROUP BY le.month, le.log_event_type_id, le.log_reason_type_id, ld.entity_uid
    ORDER BY le.month, le.log_event_type_id, le.log_reason_type_id, ld.entity_uid;

    INSERT INTO event_summary_breakdown_reason_entity (month, log_event_type_id, log_reason_type_id, entity_uid,
                                                       number_of_events, record_count)
    SELECT month, log_event_type_id, log_reason_type_id, entity_uid, num_log_event, 0
    FROM tmp_log_event_summary
    ON CONFLICT (month, log_event_type_id, log_reason_type_id, entity_uid)
        DO UPDATE SET number_of_events = event_summary_breakdown_reason_entity.number_of_events +
                                         EXCLUDED.number_of_events;

    DROP TABLE IF EXISTS tmp_aggregated_results;
    CREATE TEMP TABLE tmp_aggregated_results ON COMMIT DROP AS
    SELECT le.month,
           le.log_event_type_id,
           COALESCE(le.log_reason_type_id, -1) AS log_reason_type_id,
           ld.entity_uid,
           COALESCE(SUM(ld.record_count), 0)   AS total_record_count
    FROM log_event le
             LEFT JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
    GROUP BY le.month, le.log_event_type_id, le.log_reason_type_id, ld.entity_uid
    ORDER BY le.log_event_type_id, le.month;

    UPDATE event_summary_breakdown_reason_entity est
    SET record_count = est.record_count + tmp.total_record_count
    FROM tmp_aggregated_results tmp
    WHERE est.month = tmp.month
      AND est.log_event_type_id = tmp.log_event_type_id
      AND est.log_reason_type_id = tmp.log_reason_type_id
      AND est.entity_uid = tmp.entity_uid;


    RAISE NOTICE 'COMPLETED: event_summary_breakdown_reason_entity % %', p_start_id, p_end_id;
END;
$$;

CREATE OR REPLACE PROCEDURE process_event_summary_breakdown_reason_entity_source(
    p_start_id BIGINT,
    p_end_id BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    RAISE NOTICE 'DEBUG: event_summary_breakdown_reason_entity_source % %', p_start_id, p_end_id;

    DROP TABLE IF EXISTS tmp_aggregated_results;
    CREATE TEMP TABLE tmp_aggregated_results ON COMMIT DROP AS
    SELECT le.month,
           le.log_event_type_id,
           COALESCE(le.log_reason_type_id, -1) AS log_reason_type_id,
           ld.entity_uid,
           COALESCE(le.log_source_type_id, -1) AS log_source_type_id,
           COUNT(DISTINCT ld.id)               AS num_log_details,
           COALESCE(SUM(ld.record_count), 0)   AS total_record_count
    FROM log_event le
             LEFT JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
      AND ld.entity_uid IS NOT NULL
    GROUP BY le.month, le.log_event_type_id, le.log_reason_type_id, ld.entity_uid, le.log_source_type_id;

    INSERT INTO event_summary_breakdown_reason_entity_source (month, log_event_type_id, log_reason_type_id, entity_uid,
                                                              log_source_type_id, number_of_events, record_count)
    SELECT month,
           log_event_type_id,
           log_reason_type_id,
           entity_uid,
           log_source_type_id,
           num_log_details,
           total_record_count
    FROM tmp_aggregated_results
    ON CONFLICT (month, log_event_type_id, log_reason_type_id, entity_uid, log_source_type_id)
        DO UPDATE SET number_of_events = event_summary_breakdown_reason_entity_source.number_of_events +
                                         EXCLUDED.number_of_events,
                      record_count     = event_summary_breakdown_reason_entity_source.record_count +
                                         EXCLUDED.record_count;

    RAISE NOTICE 'COMPLETED: event_summary_breakdown_reason_entity_source % %', p_start_id, p_end_id;
END;
$$;

-- NOTE: It only updates the record_count for 'dr' entity, as per the existing trigger logic
-- It splits two processes: one for counting number_of_events, another for record_count of 'dr' entity only

CREATE OR REPLACE PROCEDURE process_event_summary_totals(
    p_start_id BIGINT,
    p_end_id BIGINT
) LANGUAGE plpgsql AS
$$
BEGIN
    -- Phase 1: Count number_of_events per month and event_type (excludes log_events without log_details)
    DROP TABLE IF EXISTS tmp_log_event_summary;
    CREATE TEMP TABLE tmp_log_event_summary
    (
        month             TEXT,
        log_event_type_id INT,
        num_log_event     INT
    ) ON COMMIT DROP;

    INSERT INTO tmp_log_event_summary (month, log_event_type_id, num_log_event)
    SELECT le.month, le.log_event_type_id, COUNT(le.id)
    FROM log_event le
    WHERE le.id BETWEEN p_start_id AND p_end_id
      AND EXISTS (SELECT 1 FROM log_detail ld WHERE ld.log_event_id = le.id)
    GROUP BY le.month, le.log_event_type_id;

    INSERT INTO event_summary_totals (month, log_event_type_id, number_of_events, record_count)
    SELECT month, log_event_type_id, num_log_event, 0
    FROM tmp_log_event_summary
    ON CONFLICT (month, log_event_type_id)
        DO UPDATE SET number_of_events = event_summary_totals.number_of_events + EXCLUDED.number_of_events;

    -- Phase 2: Update record_count for 'dr' entity only
    DROP TABLE IF EXISTS tmp_aggregated_results;
    CREATE TEMP TABLE tmp_aggregated_results ON COMMIT DROP AS
    SELECT le.month,
           le.log_event_type_id,
           COALESCE(SUM(ld.record_count), 0) AS total_record_count
    FROM log_event le
             INNER JOIN log_detail ld ON ld.log_event_id = le.id
    WHERE le.id BETWEEN p_start_id AND p_end_id
      AND LEFT(ld.entity_uid, 2) = 'dr'
    GROUP BY le.month, le.log_event_type_id;

    UPDATE event_summary_totals est
    SET record_count = est.record_count + tmp.total_record_count
    FROM tmp_aggregated_results tmp
    WHERE est.month = tmp.month
      AND est.log_event_type_id = tmp.log_event_type_id;


    RAISE NOTICE 'COMPLETED: event_summary_breakdown_total % %', p_start_id, p_end_id;
END;
$$;

CREATE OR REPLACE PROCEDURE process_new_events()
    LANGUAGE plpgsql AS $$
DECLARE
    start_id   BIGINT;
    end_id     BIGINT;
    page_end   BIGINT;
    lock_key   BIGINT := 123456789; -- Arbitrary unique constant for this function
    page_size  BIGINT := 20000; -- Number of events to process in each batch; adjust based on performance testing
BEGIN
    -- Attempt to acquire advisory lock; exit immediately if already held.
    -- Session-level advisory locks survive COMMITs within this procedure and
    -- are automatically released when the session ends (including on error).
    IF NOT pg_try_advisory_lock(lock_key) THEN
        RAISE NOTICE 'process_new_events already running, skipping.';
        RETURN;
    END IF;

    -- Get last processed ID (default to 0 if not set)
    SELECT COALESCE(last_processed_event_id, 0) INTO start_id
    FROM event_processing_checkpoint
    WHERE id = 1;

    -- Get latest event ID to use as the stable upper bound for this run
    SELECT MAX(id) INTO end_id FROM log_event;

    RAISE NOTICE 'process_new_events: start_id=%, end_id=%', start_id, end_id;

    -- Nothing to process
    IF end_id IS NULL OR end_id <= start_id THEN
        PERFORM pg_advisory_unlock(lock_key);
        RETURN;
    END IF;

    -- Process in pages of up to page_size.
    -- COMMIT after each page so that all temp-table locks are released,
    -- preventing "out of shared memory" / max_locks_per_transaction exhaustion
    -- when processing large numbers of events.
    -- NOTE: No EXCEPTION block here — an EXCEPTION clause creates an implicit
    -- subtransaction which makes COMMIT illegal. On error the session-level
    -- advisory lock is released automatically when the session terminates.
    WHILE start_id < end_id LOOP
        page_end := LEAST(start_id + page_size, end_id);

        RAISE NOTICE 'Processing events % to %', start_id + 1, page_end;

        CALL process_event_summary_totals(start_id + 1, page_end);
        CALL process_event_summary_breakdown_reason(start_id + 1, page_end);
        CALL process_event_summary_breakdown_reason_entity(start_id + 1, page_end);
        CALL process_event_summary_breakdown_reason_entity_source(start_id + 1, page_end);
        CALL process_event_summary_breakdown_email(start_id + 1, page_end);
        CALL process_event_summary_breakdown_email_entity(start_id + 1, page_end);

        -- Persist progress before committing so we can resume after a failure
        INSERT INTO event_processing_checkpoint (id, last_processed_event_id)
        VALUES (1, page_end)
        ON CONFLICT (id) DO UPDATE SET last_processed_event_id = page_end;

        -- Commit here: flushes all ON COMMIT DROP temp tables and releases
        -- their lock-table entries, keeping memory usage flat across pages
        COMMIT;

        start_id := page_end;
    END LOOP;

    PERFORM pg_advisory_unlock(lock_key);
END;
$$;

-- Create the event_processing_checkpoint table if it does not exist
CREATE TABLE IF NOT EXISTS event_processing_checkpoint
(
    id                      INT NOT NULL,
    last_processed_event_id INT NOT NULL,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_event_processing_checkpoint PRIMARY KEY (id)
);

-- Insert the single checkpoint row (only if not already present)
INSERT INTO event_processing_checkpoint (id, last_processed_event_id)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
