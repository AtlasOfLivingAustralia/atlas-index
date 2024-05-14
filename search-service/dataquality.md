# Data Quality Service integration

## Current state
Data quality app contains very little data, that does not change often, and has a large amount of traffic. It has a database, admin editor, and several API services.

## Future state
- Admin API to edit the data.
- A database table to store the data.
- A service that writes the table to a single JSON file, after a change.
- Legacy V1 user API to read from a cached file.

## Progress
- [x] Legacy V1 user API to read from a cached file. (cached file is https://data-quality-service.ala.org.au/api/v1/data-profiles with the correct addition of `isDefault:true`)
- [x] Admin API to edit the data in the database. e.g. /v2/admin/dq, GET, POST, DELETE
- [x] Service to write the updated table, as a JSON file, in the correct location.
- [x] UI Admin page (import, export, list, add, edit, delete)
- [ ] UI Admin page; edit displayOrder and basic formatting
