# Data Quality Service integration

## Current state
Data quality app contains very little data, that does not change often, and has a large amount of traffic. It has a database, admin editor, and several API services.

## Future state
- Admin API to edit the data.
- A database table to store the data.
- A service that writes the table to a single JSON file, after a change.
- Legacy V1 user API to read from a cached file.

## Progress
- [ ] Legacy V1 user API to read from a cached file.
- [ ] Admin API to edit the data in the database. e.g. /v2/admin/list, /v2/admin/delete, /v2/admin/add (also does update if an id is present)
- [ ] Service to write the database table as a JSON file in the correct location.
