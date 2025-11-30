# Fieldguide integration

## Details
API for generating fieldguide PDFs for a list of taxonConceptIDs. Can email a URL to a generated PDF to a user's email address.
- Using Apache FOP to generate the PDF from a template.
- Includes admin API to manage fieldguide requests. See admin-ui.

## Migration
Prior downloads are not migrated and will no longer be available. The old emails with URLs to these also contain URLs to recreate previously created PDFs as needed.

## Changes
No change to the V1 API or the PDF produced.

## Configuration
Configuration options are in `application.properties`.
- For fieldguide specific config use the properties `fieldguide.*` e.g. set `fieldguide.email.enabled=true` to send the completion notification email.
- PDFs are saved to `download.filestore.path`. `application.properties` has details on configuring this and related properties, e.g. `download.s3.*` properties.

## Development
### PDF Template Customization
The PDF templates are located in `src/main/resources/templates`. To customize the templates for your deployment or development:
1. Clone the [templates](src/main/resources/templates) folder to a local directory.
2. Configure `fieldguide.template.path` in `application.properties` to point to this local directory.
3. Run the service and use the API to generate a test PDF to verify this is working. e.g generate a fieldguide PDF with admin-ui.
4. Repeat "edit the template, generate a test PDF" until satisfied.

