-- 1. Create the sequence if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'doi_id_seq') THEN
        CREATE SEQUENCE doi_id_seq;
    END IF;
END$$;

-- 2. Attach the sequence to the id column for auto-increment
ALTER TABLE doi ALTER COLUMN id SET DEFAULT nextval('doi_id_seq');

-- 3. Set the sequence to start after the current max id
SELECT setval('doi_id_seq', COALESCE((SELECT MAX(id) FROM doi), 0) + 1, false);
