## ALA SDS static home page (legacy)

Before ALA was using `ala-sensitive-data-service`, it had `sds-webapp2`, which was a Grails app that pulled in the `sds` libary. It served API endpoints, generated the `sensitive-species-data.xml` file and provided a simple web front end via the URL `sds.ala.org.au`.  `ala-sensitive-data-service` took over the API duties and the XML file generation has been moved to an Airflow job, resulting in the XML files being saved to s3.

This directory contains the static HTML file for the home page from `sds-webapp2`. It links to the XML files via either a direct HTTP Cloudfront URL to the s3 file or by linking to the API for `ala-sensitive-data-service`. The HTML file should be served from s3 via Cloudfriont, similar to the `sensitive-species-data.xml` file.

## Getting started

### Config

- For ALA development, copy `.env.local` from [atlas-index/local/sds-ui](https://github.com/AtlasOfLivingAustralia/ansible-inventories/tree/master/atlas-index/local/sds-ui) into this directory. That directory also has the deployment notes.
- For any other setup, create a `.env.local` in this directory using the [Environment variables](#environment-variables) below. `yarn run dev` loads it.

```bash
yarn install
yarn run dev
```

## Environment variables

The following environment variables are read from `src/` at build time. A production build fails if any of them is missing from `.env.local`; an empty value is allowed. Example values below match a local run against the test services.

```properties
# Home breadcrumb link
VITE_HOME_URL=https://ala.org.au

# Written into a page meta tag, for example local, test or production
VITE_ENV=local

# This app's public URL. Logout returns here, and the URL must be registered with the auth provider.
VITE_APP_BASE_URL=http://localhost:5173

# search-service base URL. Login, logout and session checks call {url}/login, {url}/logout and {url}/session.
VITE_APP_API_URL=http://localhost:8081

# Sensitive Data Service web service. The page links to {url}/categories, {url}/zones and {url}/layers.
VITE_APP_SENSITIVE_WS_URL=https://sensitive-ws-test.ala.org.au/ws

# Swagger UI for the Sensitive Data Service. The page links to the report endpoint.
VITE_APP_SENSITIVE_SWAGGER_URL=https://sensitive-ws-test.ala.org.au/swagger

# Sensitive species XML. When empty, the page uses /sensitive-species-data.xml.
VITE_APP_SENSITIVE_SPECIES_XML_URL=https://sensitive-ws-test.ala.org.au/sensitive-species-data.xml

# Species lists that make up the SDS, opened from the Resources section
VITE_APP_LISTS_URL=https://lists.test.ala.org.au/?filters=isSDS:true

# Help article linked as "Data Sensitivity"
VITE_APP_ALA_HELP_SENSITIVE_URL=https://support.ala.org.au/support/solutions/articles/6000261705-working-with-conservation-and-sensitive-species-information

# Common header and footer templates, plus styles and scripts. CSS and JS accept a comma-separated list of URLs.
# yarn run dev serves the static-server copies on port 8082.
VITE_COMMON_HEADER_HTML=http://localhost:8082/static/common/banner.mustache
VITE_COMMON_FOOTER_HTML=http://localhost:8082/static/common/footer.mustache
VITE_COMMON_CSS=http://localhost:8082/static/common/ala-combined.css
VITE_COMMON_JS=http://localhost:8082/static/common/ala-combined.js
# Substituted for {{containerClass}} in the header template. container-fluid or container.
VITE_COMMON_CONTAINER_CLASS=container-fluid
# Substituted for the header search box ({{searchServer}}{{searchPath}})
VITE_SEARCH_URL_PREFIX=https://bie.test.ala.org.au

# Status messages. The banner shows entries keyed "global" and this scope.
VITE_BANNER_MESSAGES_URL=http://localhost:8082/static/common/status.json
VITE_BANNER_SCOPE=sds
```

## Playwright tests
Playwright tests are included to verify basic functionality. Running in headless mode by default. To run the tests:
```bash
./run-playwright-test.sh [workers, default 10]
```
This script mocks static-server content (via `tests/mocks/staticServerMocks.ts`, rather than starting a real server). Then it will run the tests against a locally running sds-ui instance that is built to use `.env.playwright` for config.
- If using a different method, ensure you are using the same config as in `.env.playwright`. See `run-playwright-test.sh` for all environment details.
- If using playwright ui mode,
   - copy `.env.playwright` to `.env.local`
   - start in dev mode `yarn run dev` so that any changes to the app apply immediately (this also serves static-server content on port 8082 automatically)
   - then start ui mode `yarn playwright test --ui`, any changes to the tests will apply immediately

### Live tests

`run-live-test.sh` runs the acceptance tests (`tests/acceptance.spec.ts` only) against a real deployed environment, with no local build or mocking:
```bash
./run-live-test.sh [config-file, default live-config.json] [workers]
```
See `live-config.json` (test) and `live-prod-config.json` (production) for the base URL, skip list, timeouts and assertion overrides used against each environment.

