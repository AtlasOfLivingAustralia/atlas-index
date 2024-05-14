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
- [x] Add persistence to the queue service.
- [ ] Check for consumer failure and add orphaned tasks back into the queue.
- [x] Generate a single PDF from a list of guids using a template.
- [x] Add a service to add a request to the queue.
- [x] Add the PDF generator consume from the queue.
- [x] Put the PDF in the correct location.
- [ ] Send an email when the PDF is ready.
- [x] Legacy V1 API.
- [ ] New V2 API.
