# Purpose
This tool extracts taxon data from various sources. This data is distributed to a file system and is available to a UI.

This tool is intended to run every 6 months to update the data extracts.

The data extracts are used to produce a JSON file for each accepted taxon ID.

## Dependencies
Generate ALA token for profiles API access
1. Create an application with userdetails, "my applications" page.
2. Request an increase to the token expiry for this clientID. At least 1 day.
3. Generate a token for this clientID.
4. Save the `access_token` value to a file, e.g. `/data/alaToken`, or as defined in `config.json`.

Get list of wikipedia titles 
1. Download the latest wikipedia titles list from `https://dumps.wikimedia.org/enwiki/latest/`, `enwiki-latest-all-titles-in-ns0`.
2. Save to `/data/enwiki-latest-all-titles-in-ns0`, or as specified in `config.json`.
3. Use the previous `/data/wikipedia-tmp` directory, and contents, if available, to make use of previously downloaded html. 
 - Delete `/data/wikipedia-tmp/matched.csv` if there is a new `enwiki-latest-all-titles-in-ns0` or `accepted.csv` file.
 - Delete directories `/data/wikipedia-tmp/cache_*` if there is a need to re-download html for existing taxonIds.

Get the accepted names. TODO: use V1 or V2 API service instead of using a SOLR tunnel
1. download from tunneled SOLR to `/data/accepted.csv`, or as specified in `config.json`
```shell
   curl "http://localhost:8984/solr/bie/select?fl=guid,scientificName,genus_s,family_s,order_s,class_s,phylum_s,kingdom_s&fq=-acceptedConceptID:*&indent=on&q=idxtype:TAXON&rows=400000&wt=csv" > /data/accepted.csv
```

## Build

```shell
mvn package
```

## Run

For a single data source:
```shell
java -jar target/taxon-descriptions-0.0.1-SNAPSHOT-jar-with-dependencies.jar ./config.json {filename}
```
Where `{filename}` is a filename found in the config.json file.

For all data sources:
```shell
./getAll.sh
```

## Produces
```shell
{filename}.json
```

The output json consists of metadata and HTML content for a map of accepted taxon IDs

```json
{
  "created": "2021-08-31T00:00:00Z",
  "filename": "foa.json",
  "name": "Flora Of Australia",
  "taxa": {
    "{acceptedTaxonID}": {
      "url": "https://profiles.ala.org.au/opus/foa/taxon/{taxonName}",
      "habitat": "HTML habitat text with an <a href=\"ala.org.au\">example a tag</>",
      "biology": "HTML biology text with an <a href=\"ala.org.au\">example a tag</>"
    }
  }
}
```

## Merging data sources

Runnign with the `{filename}` as `merge` to merge. This merges all of the data sources, including the
`overrides.json`, into the output directory as `./{last2TaxonIChars}/{URL encoded taxonID}.json`.

TODO: more info on merging
- errors.csv
- testing some of the output JSON
- copying to an appropriate destination

## Errors

See `/data/wikipedia-tmp/errors.csv` for a list of taxonIds that need to be manually resolved. Resolution is done by creating a new entry in `/data/wikipedia-tmp/overrides.csv`, details on how to do this are below.

## Configuration

The config.json file supports the following types:
- "profiles"
  - Extracts data from the ALA profiles API
  - Requires a list of fields to extract
  - Requires the profile ID used in the API
  - Requires file with an ALA token

```json
{
  "profilesUrl": "https://profiles.ala.org.au",
  "profilesThreads": 1,
  "alaToken": "/data/alaToken",
  "wikipediaUrl": "https://en.wikipedia.org/api/rest_v1/page/html/",
  "wikipediaTitles": "/data/taxon-descriptions/enwiki-latest-all-titles-in-ns0",
  "wikipediaTmp": "/data/taxon-descriptions",
  "wikipediaUserAgent": "",
  "acceptedCsv": "/data/taxon-descriptions/accepted.csv",
  "listsUrl": "https://lists.ala.org.au",
  "mergeDir": "/data/taxon-descriptions/merge",
  "overrideFile": "/data/taxon-descriptions/overrides.json",
  "sources": [
    {
      "name": "Flora of Australia",
      "type": "profiles",
      "id": "0ded7a77-9efb-4684-8df0-48cbb1933684",
      "attribution": "<a href=*URL*>Profiles</a>",
      "fields": [
        "Description",
        "Habitat",
        "Phenology"
      ]
    },
    {
      "name": "SpongeMap",
      "type": "species-list",
      "id": "dr842",
      "attribution": "<a href=*URL*>Species List</a>",
      "fields": [
        "Growth_Form",
        "Colour"
      ]
    },
    {
      "filename": "wikipedia",
      "name": "Wikipedia",
      "attribution": "<a href=*URL*>Wikipedia</a>",
      "type": "wikipedia"
    }
  ]
}
```

## Overriding data sources

The most frequent use case is to override wikipedia data where the page is ambiguous. See `/data/wikipedia-tmp/errors.csv` (or the directory specified in `config.json`) for a list of taxonIds that need to be manually resolved.

To override an entire taxon entry for a single data source, create a new entry in `/data/wikipedia-tmp/overrides.csv` (or the directory specified in `config.json`).

The format is as follows:
```json
{
  "taxonID": {
    "source as defined in config.json, e.g. 'wikipedia'": {
        "url": "The correct source URL. Required when there is a override. Not required when excluding this source for this taxonId",
        "field for this source, see config.json for the appropriate list": "<p>HTML content</p>"
    }
  }
}
```

Replace example:
```json
{
  "urn:lsid:biodiversity.org.au:afd.taxon:7b1b1b3e-0b3b-4b3b-8b3b-9b3b3b3b3b3b": {
    "wikipedia": {
      "url": "https://en.wikipedia.org/wiki/Emu",
      "summary": "<p>HTML content</p>"
    }
  }
}
```

Exclude example:
```json
{
  "urn:lsid:biodiversity.org.au:afd.taxon:7b1b1b3e-0b3b-4b3b-8b3b-9b3b3b3b3b3b": {
    "wikipedia": {
    }
  }
}
```
