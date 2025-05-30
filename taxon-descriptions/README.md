# Purpose
This tool extracts taxon data from various sources. This data is distributed to a file system and is available to a UI.

This tool is intended to run every 6 months to update the data extracts.

The data extracts are used to produce a JSON file for each accepted taxon ID.

## Usage
Every 6 months, take the following steps to update the data extracts and merge for the UI:
1. Get the config file, see ansible-inventories
2. Get the ALA token, see userdetails
3. Get the wikipedia titles, see below
4. Get the accepted names, see below 
5. Run getAll.sh, see ansible-inventories 
6. Copy zipped extracts (JSON files and wikipedia HTML) to a shared location for backup, see S3 
7. Get the overrides.json, see S3 
8. Merge the output, see below 
9. Review the output, see below 
10. Copy the output to the destination, see below

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

Get data from vicflora
1. Uses configuration `vicFloraGraphqlUrl` to fetch the list of pages to download. 
2. Uses configuration `vicFloraUrl`, this is the prefix in front of the id returned by the graphql query so it should end with a `/`. This url + id is the page to download.
3. Remove the `vicflora-tmp.json` file if there is a need to re-download data. It is found in the configured `wikipediaTmp` directory.
4. If the fetch fails, re-running it will continue on from the progress already made in the `vicflora-tmp.json` file.

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

Running with the `{filename}` as `merge` to merge. This merges all of the data sources, including the
`overrides.json`, into the output directory as `./{last2TaxonIChars}/{URL encoded taxonID}.json`.

### Merge outputs
- `{config mergeDir}/{last2TaxonIChars}/{URL encoded taxonID}.json`, JSON file for species-pages UI. Copy to the location to be accessed at the URL in the species-pages config.
- `{config mergeDir}/errors.csv`, CSV of wikipedia pages excluded because they are flagged as ambiguous. If excluded in error, add to the overrides.json file to include the content.
- `{config mergeDir}/review{idx}.html`, HTML files, with a maximum of 500 taxa per file, for review of the HTML content.
- System out reports guids that have data from > 2 sources. This is to assist with identifying JSON files that need inspection.

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

## Generating Hero Descriptions
To generate hero descriptions, use the following command:
```shell
java -cp target/taxon-descriptions-0.0.1-SNAPSHOT-jar-with-dependencies.jar au.org.ala.DescriptionsExtractor
```
The directory containing the merged JSON files and output file location must be specified in the `config.json` file. 

The output file will be a JSON file containing the hero descriptions for each taxon ID. Example:
```json
{
  "https%3A%2F%2Fid.biodiversity.org.au%2Fnode%2Fapni%2F2904786": "<p>Tree to 30 m tall; branchlets ferrugineous-pubescent, glabrescent, with scattered lenticels.",
  "https%3A%2F%2Fid.biodiversity.org.au%2Fnode%2Fapni%2F2892310": "<p>Spreading to sprawling low shrub 20-30 (-50?) cm tall. Branchlets strongly angular.",
}
```