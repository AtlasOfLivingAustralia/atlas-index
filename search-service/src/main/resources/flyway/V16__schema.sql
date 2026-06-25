-- Trigger to keep event_processing_checkpoint.updated_at current on every UPDATE

CREATE OR REPLACE FUNCTION set_event_processing_checkpoint_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql AS
$$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_event_processing_checkpoint_updated_at
    BEFORE UPDATE
    ON event_processing_checkpoint
    FOR EACH ROW
EXECUTE FUNCTION set_event_processing_checkpoint_updated_at();

