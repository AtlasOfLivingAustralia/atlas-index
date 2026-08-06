## ALA SDS static home page (legacy)

Before ALA was using `ala-sensitive-data-service`, it had `sds-webapp2`, which was a Grails app that pulled in the `sds` libary. It served API endpoints, generated the `sensitive-species-data.xml` file and provided a simple web front end via the URL `sds.ala.org.au`.  `ala-sensitive-data-service` took over the API duties and the XML file generation has been moved to an Airflow job, resulting in the XML files being saved to s3.

This directory contains the static HTML file for the home page from `sds-webapp2`. It links to the XML files via either a direct HTTP Cloudfront URL to the s3 file or by linking to the API for `ala-sensitive-data-service`. The HTML file should be served from s3 via Cloudfriont, similar to the `sensitive-species-data.xml` file.

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

