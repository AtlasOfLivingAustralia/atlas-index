# Dashboard integration

## Details
The dashboard data is updated on a schedule, or trigger in the admin-ui, and stored as static files:
- `dashboard.json` to be used by the UI to render the current information.
- `dashboard.zip` zipped CSV files for each dashboard item.
- `dashboardI18n.json` is the solution to the UI i18n requirements.
- `summary.json` is the summary of the dashboard data, used by the ALA home page.

The destination for these files is configured at the `static.filestore.path` parameter of `application.properties`, 
supports AWS S3 and local paths, and may be the same as the deployed static files so that it overwrites the existing 
files directly.

## Changes
- `summary.json` should be made available with the path `/dashboard/homePageStats`, if required.
