# Atlas search

System for searching ALA non-occurrence data. Replaces bie-index.

It is a work in progress and is not yet ready for production use.

TODO: move compatible [ala-security-project branch](https://github.com/AtlasOfLivingAustralia/ala-security-project/tree/epic/java21/develop) of SNAPSHOT

## Requirements
- JDK 21

## Approach

The approach taken by this project, in no particular order:
- search-service is a drop in replacement of the bie-index external API.
- search-service will add a V2 API. It will tag services in the bie-index openapi specification as V1.
- search-service is intended to serve as the backend to the redesigned species and search page.
- default-ui will serve as a basic single page UI for development. 
- default-ui will serve as a template when implementing UI/UX design outputs.
- default-ui will contain development and testing only tools. For example, a vocabulary viewer that is both incomplete and not intended for production. 
- Additional functionality will be added with the short term goal of creating a monolithic application and project. This is not the final goal but is a step towards it.
- Additional queable services will be added to search-service. These are intended to include tasks currently performed in other products. The end goal is to have an independent task consumer that scales horizontally and can serve as a template for other task consumers. 
  - Includes dashboard content generation. The current dashboard includes old data that is not updated.
  - To include fieldguide generation. The current fieldguide method of producing PDFs requires too much memory and is not queued.
  - To include DOI generation. The current DOI generation is experiencing irregular and unknown failure.
- Additional search and show services for use by a single page application. These are intended to include services that are proxies for queries into a database (elasticsearch, postgres, etc). The end goal is to have a realtime request responder that scales horizontally.
  - To include DOI search. With the inclusion of DOI generation there is only a basic list and show service from postgres, which should not need a separate server.
- Assess an external queue, e.g. RabbitMQ, for queable services that should scale. 
- Assess an external database, e.g. Postgres or MongoDB, as the only database, to reduce deployment complexity. For use by queable services for persistence.

## Progress
1. Replace bie-index. 
   - [x] Implement search-service to replace bie-index, replicating the existing API.
   - [ ] Prepare a subset of the DwCA for integration testing.
   - [ ] Prepare mocking responses for all other sources of data.
   - [ ] Implement integration import tests.
   - [ ] Add ansible, to an ala-install branch, for deployment.
   - [ ] Write up the differences between bie-index and search-service.
   - [ ] Deploy for wider testing.
2. Replace ala-bie-hub and bie-index admin UI functions related to bie-index.
   - [x] Implement a view in default-ui to run admin tasks.
   - [x] Implement a view in default-ui to edit species records for; preferred images, hidden images and wiki URL.
3. Replace dashboard.
   - [x] Implement a task in search-service to build and update dashboard content.
   - [x] Implement a view in default-ui to replicate the dashboard non-chart content.
   - [ ] Implement a view in default-ui to replicate the dashboard chart content.
4. Replace ala-bie-hub
   - [x] Implement a view in default-ui to very loosly replicate the ala-bie-hub (search, list, show).
   - [ ] Implement a view in default-ui according to the new UI/UX design, when it is available.

## Components

* [default-ui](default-ui) - Admin web application for managing the search index. Includes other default pages.
* [names-extract](names-extract) - Java application that extracts name information from the Lucene names index to supplement the DwCA names index imported into search-service.
* [search-service](search-service) - Spring boot REST web services for accessing and administering the search index.
* [search-test](search-test) - Java application for comparing GET responses of bie-index and search-service.
* [static-server](static-server) - Development only file server for serving static files. Production should use a proper file server.
* [taxon-descriptions](taxon-descriptions) - Java application for generating taxon descriptions from the profiles, wikipedia, species-lists, and other sources.

## Local Development Setup

To setup for local use you will need to, in order:
1. [Generate supplemental data for search-service](names-extract/README.md)
2. [Start search-service after setting up Elasticsearch and configuring authentication](search-service/README.md)
3. [Serve static files for the default-ui using static-server (for optional default-ui functionality)](static-server/README.md)
4. [Start default-ui and start building the admin index. See the Atlas Admin page.](default-ui/README.md)
