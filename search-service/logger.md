# Logger service integration

## Details
The flyway sql populates the tables `log_event_type`, `log_reason_type`, and `log_source_type` with default values. 
Installations will remove or add to these tables to customise.

## Data migration
These are basic instructions to migrate an existing MySQL logger database to the flyway created Postgresql. This is not 
a full migration plan, and may be missing steps or details, but should be enough to get started.

1. Create the Postgresql database and tables using flyway as usual.
2. Transfer the data from MySQL to Postgresql for tables `log_event`, `log_detail`, `log_event_type`, `log_reason_type`, and `log_source_type`.

Example commands for step 2 are below. These are not comprehensive and need to be adjusted for your specific environment and requirements.
```
mysql>
SELECT * INTO OUTFILE '/var/lib/mysql-files/log_event.csv' FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '\\' LINES TERMINATED BY '\n' FROM log_event;

psql>
\copy log_event from '/data/log_event.csv' with (format csv, header false, DELIMITER ',', QUOTE '"', ESCAPE '\', NULL '\N', ENCODING 'LATIN1');
```

```
bash>
mysql -h 127.0.0.1 -u root -p -D logger --batch --raw -e "SELECT * FROM log_detail" > log_detail.csv

psql>
\copy log_detail from '/data/log_detail.csv' with (format csv, header true, DELIMITER E'\t', QUOTE '"', ESCAPE '\', NULL '\N', encoding 'LATIN1');
```

3. Update the sequences for the `log_event` and `log_detail` tables in Postgresql to ensure they continue from the correct values after the data import.
```sql
SELECT setval(pg_get_serial_sequence('log_event', 'id'), COALESCE(MAX(id), 1)) FROM log_event;
SELECT setval(pg_get_serial_sequence('log_detail', 'id'), COALESCE(MAX(id), 1)) FROM log_detail;
```

3. Rebuild summary tables. This can be triggered with the admin task `LOGGER_UPDATE_SUMMARY_TABLES`, wait for it to 
run as scheduled, or run in the database with `CALL process_new_events();`.

## Changes
- Scheduling of summary table updates is triggered by the application rather than an external mechanism.
- Grails scaffolding UI is not included.
- Modifying `log_event_type`, `log_reason_type`, and `log_source_type` is now done directly in the database as the 
scaffolding UI is not included.
- TODO: Admin report UI is found in admin-ui. 
- Removed internal only API `/service/logger/{id}`.
- Moved whitelisted ips from the database into application config `logger.permitted.ips`. Included but is a deprecated
feature.
- Log events can now be created with permitted JWT. This replaces whitelisting.



