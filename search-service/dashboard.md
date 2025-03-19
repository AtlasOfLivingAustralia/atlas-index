# Dashboard integration

## Current state
Dashboard grails application is gsp pages on top of both static and dynamic data services. The static data is rarely updated.

## Future state
The data will be generated on a schedule, or trigger, and stored as static files:
- `dashboard.json` to be used by the UI to render the current information.
- `dashboard.zip` zipped CSV files for each dashboard item.
- `dashboardI18n.json` is the solution to the UI i18n requirements.

## Progress
- [x] Create task on a schedule to generate the data.
- [x] Store the data in the correct location.
- [x] Add a standalone UI for the dashboard using the current styling.
- [x] Display the tables.
- [x] Display the charts.
- [x] Display the occurrence tree.
- [x] Add buttons to download the JSON and ZIP files.
