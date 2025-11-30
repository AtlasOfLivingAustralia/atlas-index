# Data Quality Service integration

## Details
Data Quality Service provides APIs to retrieve quality profiles that define sets of filters to apply for biocache-search queries.
- Admin API to edit the data.
- Legacy V1 API.

## Data Migration 
1. Using the existing Data Quality Service admin UI, export each quality profile. The exports will be JSON files.
2. Using the admin-ui, import the JSON files into the new Data Quality Service.
3. Manually copy any manually set inverse filters, for each profile, from the old Data Quality Service to the new one.

## Changes
- Manual ordering of items is no longer supported. If client ordering is required use alphabetical ordering.
- `inverseFilter` is present in additional JSON responses.
- Using explicit `OR` instead of implied `OR` in constructed inverse filters.
