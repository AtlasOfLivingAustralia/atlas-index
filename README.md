# Atlas search

Work in progress aggregation of services and UI for the Atlas of Living Australia.

- Using Spring Boot, React, Elasticsearch, PostgresSQL, and RabbitMQ.
- Suitable for Kubernetes deployment.

## Overview

It is a work in progress and subject to change.

| Component                                | Replaces                                                                        | Progress | 
|------------------------------------------|---------------------------------------------------------------------------------|----------|
| [search-service](search-service)         | https://github.com/AtlasOfLivingAustralia/bie-index (service)                   | 90%      |
|                                          | https://github.com/AtlasOfLivingAustralia/dashboard (service)                   | 100%     |
|                                          | https://github.com/AtlasOfLivingAustralia/fieldguide (service)                  | 100%     |
|                                          | https://github.com/AtlasOfLivingAustralia/data-quality-filter-service (service) | 95%      |
|                                          | https://github.com/AtlasOfLivingAustralia/doi-service (service)                 | 100%     |
|                                          | https://github.com/AtlasOfLivingAustralia/logger-service (service)              | 80%      |
| [search-ui](search-ui)                   | https://github.com/AtlasOfLivingAustralia/ala-bie-hub (UI)                      | 90%      |         
| [dashboard-ui](dashboard-ui)             | https://github.com/AtlasOfLivingAustralia/dashboard (UI)                        | 100%     |
| [regions-ui](regions-ui)                 | https://github.com/AtlasOfLivingAustralia/regions (UI)                          | 100%     |
| [admin-ui](admin-ui)                     | Admin UI                                                                        | 100%     |
| [doi-ui](doi-ui)                         | https://github.com/AtlasOfLivingAustralia/doi-service (UI)                      | 100%     |
| [occurrence-ui](occurrence-ui)           | https://github.com/AtlasOfLivingAustralia/ala-hub (UI)                          | 50%      |
|                                          | https://github.com/AtlasOfLivingAustralia/biocache-hub (UI)                     | 50%      |
|                                          | https://github.com/AtlasOfLivingAustralia/downloads-plugin (UI)                 | 80%      |
|                                          | https://github.com/AtlasOfLivingAustralia/ala-charts-plugin (UI)                | 80%      |
| [taxon-descriptions](taxon-descriptions) | New data preparation tool                                                       | 100%     |
| [names-extract](names-extract)           | New data preparation tool                                                       | 100%     |
| [search-test](search-test)               | local development tool                                                          | 100%     |
| [specimens-ui](specimens-ui)             | https://github.com/AtlasOfLivingAustralia/specimenbrowser (UI)                  | 100%     |
| [static-server](static-server)           | local development tool                                                          | 100%     |

## Components

* [admin-ui](admin-ui) - Admin UI for search-service.
* [common-ui](common-ui) - Common UI components used by other UI projects.
* [dashboard-ui](dashboard-ui) - Dashboard with a summary of ALA data.
* [doi-ui](doi-ui) - Pages to display DOIs using search-service.
* [occurrence-ui](occurrence-ui) - Pages to search and display occurrence information. Includes "Explore your area" page.
* [names-extract](names-extract) - Java application that extracts name information from the Lucene names index to
  supplement the DwCA names index imported into search-service.
* [regions-ui](regions-ui) - Pages to inspect and interact with some spatial regions for their species data.
* [search-service](search-service) - Spring boot REST web services for accessing and administering the search index and
  other data.
* [search-test](search-test) - Java application for comparing GET responses of bie-index and search-service.
* [search-ui](search-ui) - Pages to search the search-service index and display species information.
* [specimens-ui](specimens-ui) - Pages to search and display specimen information for some sources.
* [static-server](static-server) - Development only file server for serving static files. Production should use a proper
  file server.
* [taxon-descriptions](taxon-descriptions) - Java application for generating taxon descriptions from profiles,
  wikipedia, species-lists, and other sources.

## Local Development

To prepare the search-service and other UI requirements for local development, follow these steps:

1. [Generate supplemental data for search-service](names-extract/README.md) (or fetch the ALA internal bucket)
2. (Optional) [Harvest taxon descriptions for search-service and search-ui](taxon-descriptions/README.md) (or fetch from
   the ALA internal bucket)
3. [Start search-service after setting up Elasticsearch, PostgreSQL, RabbitMQ and configuring authentication](search-service/README.md)
4. [Serve static files for UI pages using static-server](static-server/README.md)
5. [Start admin-ui and start building the admin index. See the Admin page.](admin-ui/README.md)

The user UI applications can now be configured and started.

1. [Start admin-ui](admin-ui/README.md)
2. [Start dashboard-ui](dashboard-ui/README.md)
3. [Start doi-ui](doi-ui/README.md)
4. [Start regions-ui](regions-ui/README.md)
5. [Start search-ui](search-ui/README.md)
6. [Start specimens-ui](specimens-ui/README.md)
7. [Start occurrence-ui](occurrence-ui/README.md)
