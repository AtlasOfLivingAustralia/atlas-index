# Atlas search

Work in progress aggregation of services and UI for the Atlas of Living Australia.

- Using Spring Boot, React, Elasticsearch, Mongodb, and RabbitMQ.
- Suitable for Kubernetes deployment.

## Overview

It is a work in progress and subject to change.

| Component                                | Replaces                                                                        | Progress | 
|------------------------------------------|---------------------------------------------------------------------------------|----------|
| [search-service](search-service)         | https://github.com/AtlasOfLivingAustralia/bie-index (service)                   | 90%      |
|                                          | https://github.com/AtlasOfLivingAustralia/dashboard (service)                   | 95%      |
|                                          | https://github.com/AtlasOfLivingAustralia/fieldguide (service)                  | 80%      |
|                                          | https://github.com/AtlasOfLivingAustralia/data-quality-filter-service (service) | 95%      |
|                                          | https://github.com/AtlasOfLivingAustralia/sandbox (service)                     | 60%      |
| [search-pages](species-pages)            | https://github.com/AtlasOfLivingAustralia/ala-bie-hub (UI)                      | 85%      |         
| [dashboard-ui](dashboard-ui)             | https://github.com/AtlasOfLivingAustralia/dashboard (UI)                        | 100%     |
| [regions-ui](regions-ui)                 | https://github.com/AtlasOfLivingAustralia/regions                               | 90%      |
| [default-ui](default-ui)                 | Admin UI (bie-index, ala-bie-hub, data-quality-filter-service, sandbox)         | 80%      |
| [taxon-descriptions](taxon-descriptions) | New data preparation tool                                                       | 95%      |
| [names-extract](names-extract)           | New data preparation tool                                                       | 100%     |
| [search-test](search-test)               | local development tool                                                          | 100%     |
| [static-server](static-server)           | local development tool                                                          | 100%     |
| [cicd](cicd)                             | New CICD tool                                                                   | 0%       |

## Components

* [dashboard-ui](dashboard-ui) - Dashboard with a summary of ALA data.
* [default-ui](default-ui) - Admin UI for all components integrated.
* [names-extract](names-extract) - Java application that extracts name information from the Lucene names index to
  supplement the DwCA names index imported into search-service.
* [regions-ui](regions-ui) - Page to inspect and interact with some spatial regions for their species data.
* [search-service](search-service) - Spring boot REST web services for accessing and administering the search index.
* [search-test](search-test) - Java application for comparing GET responses of bie-index and search-service.
* [static-server](static-server) - Development only file server for serving static files. Production should use a proper
  file server.
* [taxon-descriptions](taxon-descriptions) - Java application for generating taxon descriptions from profiles,
  wikipedia, species-lists, and other sources.

## Local Development

To prepare the search-service and other UI requirements for local development, follow these steps:

1. [Generate supplemental data for search-service](names-extract/README.md)
2. (Optional) [Harvest taxon descriptions for search-service and species-pages](taxon-descriptions/README.md)
3. [Start search-service after setting up Elasticsearch, Mongodb and configuring authentication](search-service/README.md)
4. [Serve static files for UI pages using static-server](static-server/README.md)
5. [Start default-ui and start building the admin index. See the Atlas Admin page.](default-ui/README.md)

The user UI applications can now be configured and started.
1. [Start dashboard-ui](dashboard-ui/README.md)
2. [Start regions-ui](regions-ui/README.md)
3. [Start species-pages](species-pages/README.md)
