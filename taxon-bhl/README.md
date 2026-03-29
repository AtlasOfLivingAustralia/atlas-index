# taxon-bhl

Fetches BHL (Biodiversity Heritage Library) publication results for all accepted taxa and writes the results to a directory structure for use by the species-pages UI.

## Purpose

For each accepted taxon in the configured CSV, calls the BHL PublicationSearch API and writes one output file per taxon (when results are found):

| File | API endpoint | Notes |
|------|-------------|-------|
| `{encodedGuid}.json` | `/api3?op=PublicationSearch` | Only written when BHL returns ≥ 1 result |

The stored file contains the JSON `Result` array from the BHL API response, identical to what the BHL API returns — allowing the search-ui to consume it directly without an API key.

## Output layout

```
{bhlDir}/{last2LsidChars}/{urlEncodedLsid}.json
```

Files that already exist are skipped, so the run can be safely restarted.

## Dependencies

Get the accepted names CSV (same file used by taxon-descriptions and taxon-traits):
```shell
curl "https://{search-service}/v1/bie/download?q=-acceptedConceptID:*%20AND%20idxtype:TAXON&fields=guid,scientificName,rk_genus,rk_family,rk_order,rk_class,rk_phylum,rk_kingdom" -o /data/search-service/data/accepted.csv
```

Confirm row count:
```shell
wc -l /data/search-service/data/accepted.csv
```

## Build

```shell
mvn package
```

## Run

```shell
java -jar target/taxon-bhl-0.0.1-SNAPSHOT-jar-with-dependencies.jar ./config.json
```

## Configuration

| Key | Description | Default                              |
|-----|-------------|--------------------------------------|
| `bhlUrl` | Base URL for the BHL website/API | required                             |
| `bhlApiKey` | BHL API key | required                             |
| `acceptedCsv` | Path to accepted.csv | required                             |
| `bhlDir` | Root output directory | required                             |
| `bhlThreads` | Concurrent fetch threads | `1`                                  |

Example `config.json`:
```json
{
  "bhlUrl": "https://www.biodiversitylibrary.org",
  "bhlApiKey": "your-bhl-api-key-here",
  "acceptedCsv": "/data/search-service/data/accepted.csv",
  "bhlDir": "/data/search-service/data/taxon-bhl",
  "bhlThreads": 1
}
```

> **Note:** Use `bhlThreads: 1` to avoid hitting BHL API rate limits.

## Progress and restartability

The tool logs progress every 500 taxa:
```
12:34:56:789 processed=500 skipped=120 written=380 errors=2
```

- **processed** — total taxa attempted
- **skipped** — files already on disk (restart resume)
- **written** — new files written this run
- **errors** — fetch failures (logged with taxon details)

Re-running the tool will skip all already-downloaded files and continue with any remaining taxa.

## Deployment

Make it accessible publicly and configure the base URL in search-ui config.
