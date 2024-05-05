# Fieldguide integration

## Current state
Fieldguide grails application is gsp pages on top of a service that generates a PDF when given a list of guids and sends an email when done.

## Future state
- The same API, versioned as V1
- A service that will queue PDF requests and send an email when done.
- A service for admin to view the queue and cancel requests.
- A service for users to view all of their requests and cancel them.

## Progress
- [x] Create a queue service.
- [ ] Add persistence to the queue service (e.g. in case of restart).
- [x] Generate a single PDF from a list of guids using a template.
- [ ] Add a service to add a request to the queue.
- [ ] Add the PDF generator consume from the queue.
- [ ] Put the pdf in the correct location.
- [ ] Send an email when the PDF is ready.
