# Search service - REST services for search service

This is a replacement for bie-index.

It is a Spring Boot application that provides REST web services for accessing and updating an Elasticsearch index.

TODO: cleanup i18n files (move to default-ui as required)
TODO: cleanup Docker files (tidy commented out sections, document local paths)

# Table of Contents

- [Getting started](#getting-started)
- [Migrating from bie-index](#migrating-from-bie-index)
- [Docker hub](#docker-hub)
- [Helm charts](#helm-charts)
- [Importing data](#import-process)
    - [Prerequisites](#prerequisites)
    - [Configure data sources](#configure-data-sources)
    - [Start import or update](#start-import-or-update)
- Other integrations
    - [Dashboard integration](dashboard.md)
    - [Fieldguide integration](fieldguide.md)
    - [Data Quality Service integration](dataquality.md)
    - [Sandbox integration](sandbox.md)

## Getting started

### Elasticsearch

To run the elasticsearch containers needed for the search-service
to run, use the following command:

```bash
docker-compose -f src/main/docker/docker-compose.yml up
```

### Running the application locally

```bash
 # Check Java 21 is current JVM with `java -version`
 mvn spring-boot:run
 ```

Open the Swagger UI for REST services at `http://localhost:8080`.

## Docker hub

The docker images for search-service are available
on TODO [docker hub](https://hub.docker.com/r/atlasoflivingaustralia/search-service).
Commits to this `develop` branch will result in a new image being built and pushed to the `latest` tag on docker hub.

## Helm charts

The helm charts for list-service are available in the
TODO [helm-charts](https://github.com/AtlasOfLivingAustralia/helm-charts) repository.

## Migrating from bie-index

### Major Changes

- OIDC only. No CAS support.
- Using Elasticsearch instead of SOLR.
- Using a single index instead of swapping between online and offline.
- An initial index build is significantly faster. The trade-off is a higher memory requirement (4.5GB) that will scale
  with the size of the DwCA names indexes imported.
- Removed JSON config files (TODO what about the mapping file required for conservation-lists.json backwards
  compatibility?)
- Suitable as standalone or Kubernetes.

### Replacing JSON config files (most of them)

External JSON config files are no longer supported.

| old                                          | new                                       | default                                                   | notes                                                                                         |
|----------------------------------------------|-------------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| conservation-lists.json:.defaultSourceField  | lists.conservation.statusField            | "status" (unchanged)                                      |                                                                                               |
| conservation-lists.json:.defaultKingdomField | deprecated                                |                                                           |                                                                                               |
| conservation-lists.json:.lists[*].uid        | lists.url                                 | lists that are isAuthoritative:true and isThreatened:true |                                                                                               |
| conservation-lists.json:.lists[*].field      | deprecated                                | "data.conservation_" + listId                             | TODO a mapping file                                                                           |
| conservation-lists.json:.lists[*].term       | deprecated                                |                                                           | TODO a mapping file                                                                           |
| conservation-lists.json:.lists[*].label      | deprecated                                |                                                           | TODO a mapping file                                                                           |
| favourite-lists.json:.defaultTerm            | deprecated                                |                                                           | static value 'favourite' (unchanged)                                                          |
| favourite-lists.json:.lists[*].uid           | lists.favourite.id                        | none                                                      | ';' separated items of listId,string. In order of priority. e.g. dr4778,interest;dr781,iconic |
| favourite-lists.json:.lists[*].defaultTerm   |                                           | one of "iconic" or "preferred" (static)                   | TODO check if this was in use                                                                 |
| hidden-images-lists.json:.lists[0].uid       | lists.images.hidden.id                    |                                                           |                                                                                               |
| hidden-images-lists.json:.lists[0].imageId   | lists.images.hidden.field                 | "image Id" (unchanged)                                    | should be "imageId" but default is "image Id"                                                 |
| images-lists.json:.preferred                 | deprecated                                |                                                           | moved to biocache-service                                                                     |
| images-lists.json:.ranks                     | deprecated                                |                                                           | moved to biocache-service                                                                     |
| images-lists.json:.imageFields               | deprecated                                |                                                           | moved to biocache-service                                                                     |
| images-lists.json:.lists[*].uid              | lists.images.preferred.id comma separated |                                                           | first list can be modified by the admin UI image preference (unchanged)                       |
| images-lists.json:.lists[*].imageId          | lists.images.preferred.field              | imageId (unchanged)                                       | can no longer be set for each individual list                                                 |
| locality-keywords.json                       | deprecated                                |                                                           |                                                                                               |
| vernacular-lists.json                        | TODO                                      |                                                           |                                                                                               |
| vernacular-name-status.json                  | TODO                                      |                                                           |                                                                                               |
| weights.json                                 | deprecated                                |                                                           | moved to au.org.ala.listsapi.util.Weight                                                      |
| wiki-lists.json:.lists[*].uid                | deprecated                                |                                                           | descriptions are managed with the taxon-descriptions tool and admin UI                        |
| wiki-lists.json:.lists[*].wikiUrl            | deprecated                                |                                                           | descriptions are managed with the taxon-descriptions tool and admin UI                        |
| additionalResultFields                       | deprecated                                |                                                           |                                                                                               |

## Importing data

You have the option to

- Build it in the environment it will be used.
- Build the Elasticsearch index locally, snapshot, and deploy the snapshot where it is required.
- Tunnel from a local environment to a remote Elasticsearch instance and build it.

### Prerequisites

1. Elasticsearch
2. Xmx >= 3GB for the initial names index import

For a clean installation, set the search index name and the task log index name.

```properties
elastic.host=localhost:9200
elastic.index=search-20240401
elastic.adminIndex=search-log-20240401
```

### Configure data sources

1. DwCA; idxtype TAXON, COMMON, TAXONVARIANT, IDENTIFIER.

    ```
    Note: Can only import when the index has no records of idxtype TAXON, COMMON, TAXONVARIANT, IDENTIFIER.
    
    Put your unpacked DwCA directories into `dwca.dir=/data/bie/import`
    
    e.g. 
    /data/bie/import/{index name}/meta.xml
    /data/bie/import/{index name}/eml.xml
    /data/bie/import/{index name}/taxon.txt
    /data/bie/import/{index name}/rightsholder.txt
    ...
    
    Each {index name} DwCA will read and imported.
    ```
2. Additional names data

- `lsid-left-right.csv` and `lsid-vernacularName.csv`
   ```
   Generate using the lucene version of the names index.
   
   Tool to generate these files is in ../names-extract
   ```

3. Other types

- biocollect; idxtype BIOCOLLECT. Configure URL
    ```properties
    biocollect.url=https://biocollect.ala.org.au`.
    ```
- collectory; idxtype COLLECTION, INSTITUTION, DATAPROVIDER, DATARESOURCE. Configure URL
    ```properties
    collections.url=https://collections.ala.org.au`.
    ```
- knowledegebase; idxtype KNOWLEDGEBASE. Configure base URL and sitemap path
    ```properties
    knowledgebase.url=https://support.ala.org.au
    knowledgebase.sitemap=/support/sitemap.xml
    ```
- wordpress; idxtype WORDPRESS
    ```properties
    wordpress.url=https://www.ala.org.au
    wordpress.sitemap=/xmlsitemap.xml
    ```
- spatial; idxtype LAYER, REGION, LOCALITY
    ```properties
    spatial.url=https://spatial.ala.org.au/ws
    spatial.uiUrl=https://spatial.ala.org.au
    ```
- lists; idxtype SPECIESLIST, COMMON
    ```properties
    lists.url=https://lists-test.ala.org.au
    lists.uiUrl=https://lists-test.ala.org.au/speciesListItem/list/
    lists.addPath=/ws/createItem
    lists.removePath=/ws/deleteItem
    ```

4. Supplementary data

- biocache; occurrence count, occurrence image + lists preferred image
    ```properties
    biocache.url=https://biocache-ws.ala.org.au/ws
    ```
- lists; iconic species, preferred species, hidden image, conservation status (COMMON), species attributes
    ```properties
    lists.search.max=1000
    lists.images.hidden.id=dr21953
    lists.images.hidden.field=image Id
    lists.images.preferred.id=dr4778
    lists.images.preferred.field=imageId
    lists.favourite.field=favourite
    lists.iconic.id=
    lists.preferred.id=
    lists.conservation.statusField=status
    ```

### configure local directories


### Start import or update

1. Start application
2. Create JWT with admin role
    ```properties
    security.admin.role=ROLE_ADMIN,ala/internal
    ```
3. Call admin REST service to start.
    ```shell
    curl -X POST "http://localhost:8081/admin/update?type=ALL" -H "Authorization: Bearer {JWT}"
    ```
   Response is
    ```json
    {"message": "task queued"}
    ```
4. Call admin REST service for status of each task.
    ```shell
    curl -X POST "http://localhost:8081/admin/info" -H "Authorization: Bearer {JWT}"
    ```
   Subset of the response
    ```json
    {
      "queues": {
        "elasticsearch": {},
        "subtasks": {},
        "tasks": {
          "activeCount": 1,
          "queueSize": 0,
          "description": "tasks queue",
          "queueCapacity": 100
        }
      },
      "tasks": {
        "BIOCOLLECT": {},
        "ALL": {
          "log": [
            {
              "id": "ALL-1712000000000",
              "task": "ALL",
              "modified": 1712000000000,
              "message": "Started"
            }
          ],
          "description": "update from all data sources",
          "enabled": true
        },
        "DWCA": {},
        "SITEMAP": {},
        "AREA": {},
        "LISTS": {},
        "COLLECTIONS": {},
        "KNOWLEDGEBASE": {},
        "BIOCACHE": {},
        "TAXON_DESCRIPTION": {},
        "RECORD": {},
        "LAYER": {},
        "WORDPRESS": {}
      }
    }
    ```
5. Re-run for incremental updates to non-DwCA sources. Can be configured as a scheduled task:
    ```properties
    task.schedule=0 1 * * *
    ```

## Unresolved Questions

Some questions were identified during the migration process. These are not blockers but may require further
investigation.

1. There are different filters applied for "taxonomicStatus" and I wonder if they should be consistent.
    - taxonomicStatus == "accepted"
    - taxonomicStatus is one of "accepted", "inferredAccepted", "incertaeSedis", "speciesInquirenda"
    - acceptedConceptID is not defined
2. TODO: search through the code, I think they all have a comment labeled `TODO`.

## API comparison with bie-index

All services in use were tested using a subset of GET requests extracted from nginx logs.

Changes not specific to a single service

- Fewer `null` JSON values in responses.
- A V2 API is under development and the existing services will be deprecated at release.
- Services require a search may return different results due to differences in SOLR and Elasticsearch and the lack of a
  conflict resolution strategy. Other minor search changes have been made, such as changing some searches to be case
  insensitive.

### admin/ (all)

- Those in use by bie-index gsp pages are removed. See V2 API for their replacements.
- Those in use by ala-bie-hub remain.

### ws/childConcept/{id}

- There is different encoding for "nameFormat" due to changes in the external dependendency `StringEscapeUtils`. Tested
  this different HTML4 encoding and saw no differences in browser decoding. |

### ws/classification/{id}

- No change.

### ws/taxon/{id} & ws/species/{id}

- There is different encoding for "nameFormat" due to changes in the external dependendency `StringEscapeUtils`. Tested
  this HTML4 encoding and browsers display the difference in browser decoding.
- "infoSourceURL" will now be empty when the collectory record is private. e.g. dr2699, dr2700.
- "classification" may contain new values, or have the same values under a different key. TODO: what does ala-bie-hub do
  with this?
    - bie-index will display only one `<rank>` or `<rank>Guid` when there are duplicates.
    - search-service will append a numerical suffix. E.g. "informal", "informal1", "informal2".
- "imageIdentifier" may differ. The total count is similar. The mechanism to extract images from biocache-service has
  changed. It still preserves configured preferences. Due to query construction and time of query differences, a
  different image is selected.
- "conservationStatuses" differ because
    - lists-test conservation lists are undergoing development.
    - bie-index does not remove conservation status after a conservation species-list has a record removed.
- Requests searching for a commonName may vary because a different id is resolved.
    - Due to differences in SOLR and Elasticsearch it is not straight forward to align these.
    - Not all differences will be resolvable due to bie-index not including a score conflict resolution strategy.
- Requests searching for a scientific name may vary
    - bie-index does not include score conflict resolution strategy.
    - All issues found that can be resolved, are resolved.
- "favourite" may be "iconic" instead of "interest".
    - The order that bie-index applies favourites now defaults to the value "iconic" having precedence over "interest".
- "commonNames" may contain more entries
    - bie-index limits this to 40.

### ws/guid/batch & ws/guid/{id}

- `q` and `id` are now trimmed.
- Doubly encoded `q` are now doubly decoded.
- Result order varies.
    - Due to differences in SOLR and Elasticsearch it is not possible (or very difficult) to be identical.
    - bie-index does not have a score conflict resolution strategy.
- Result may vary.
    - Result is limited to 10, so due to variations in search response scoring and lack of a conflict resolution
      strategy can result in a list that is different.

### ws/search/auto.json & ws/search/auto

- FYI, you should be using namematching-ws for TAXON autocomplete.
- Due to differences in SOLR and Elasticsearch it is not possible (or very difficult) to be identical.
    - I am not a frequent user of the autocomplete service so more work may be required.

### /ws/species/lookup/bulk

- No change.

### TODO: finish service comparison

/search
/imageSearch
/download
POST
/ws/species/guids/bulklookup

COMMON records have no image?

# Additional names data

Language `name` and `uri` information missing from the DwCA names index is done using the default resource `languages.json` and can be overwritten using the config `languages.path`.

This is done during ingestion.

The default `languages.json` is constructed from [AIATSIS language code](https://data.gov.au/data/dataset/70132e6f-259c-4e0f-9f95-4aed1101c053) (2019-06-17) and [ISO-639 language codes](http://www.sil.org/iso639-3/) (2016-06-01).
```shell
{
  languageCode: { name: "languageName", uri: "languageUri" }
}
```

# More TODOs

1. Species pages require names data and this can be quite large. This is currently compressed and stored in binary 
elasticsearch fields but this may not be the best place for it. It may be better to either store it in the same
way as the taxon-descriptions (on a file server), or in the database (mongodb). File server is probably the best
because the information is only updated when the names index is updated. This raises the question that the 
taxon-descriptions might be best extended to taxon-data. This would then be suitable for all infrequently updated 
information that is not indexed.
