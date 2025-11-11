# DOI integration

## Details

A DOI minting service that integrates with DataCite to produce the DOI for an uploaded file and additional metadata.
Includes APIs for updating and listing DOIs. Allows authorised downloads of the DOI's associated file.
- doi-ui is the new UI.
- admin-ui provides the admin related UI.
- search-service (this) provides the API.

## Migration

A summary of migration from doi-service to search-service (and both admin-ui and doi-ui)
- With the database managed by search-service (flyway), copy the doi-service's `doi` table to search-service's `doi` table.
- Configure search-service properties `doi.*` to have access to existing doi-service files so they can be downloaded by authorised users.

## Changes
The major differences from the Grails doi-service.
- ANDS provider support is excluded.
- /search API endpoint is excluded.
