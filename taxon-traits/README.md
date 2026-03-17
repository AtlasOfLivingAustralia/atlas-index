# taxon-traits

Fetches AusTraits data for all accepted taxa matching the configured kingdom filter (default: Plantae) and writes the results to a directory structure for use by the species-pages UI.

## Purpose

For each accepted taxon in the configured kingdom, calls the AusTraits API and writes up to three output files per taxon:

| File             | API endpoint | Notes                                      |
|------------------|-------------|--------------------------------------------|
| `*_count.json`   | `/trait-count` | Skipped if AusTraits == 0 and summary == 0 |
| `*_summary.json` | `/trait-summary` | Skipped if empty response                  |
| `*_data.csv`     | `/download-taxon-data` | Skipped if response has no data rows       |

## Output layout

```
{traitsDir}/austraits/{last2LsidChars}/{urlEncodedLsid}_count.json
{traitsDir}/austraits/{last2LsidChars}/{urlEncodedLsid}_summary.json
{traitsDir}/austraits/{last2LsidChars}/{urlEncodedLsid}_data.csv
```

Files that already exist are skipped, so the run can be safely restarted.

## Dependencies

Get the accepted names CSV (same file used by taxon-descriptions):
```shell
curl "https://{search-service}/v1/bie/download?q=-acceptedConceptID:*%20AND%20idxtype:TAXON&fields=guid,scientificName,rk_genus,rk_family,rk_order,rk_class,rk_phylum,rk_kingdom" -o /data/taxon-traits/accepted.csv
```

Confirm row count:
```shell
wc -l /data/taxon-traits/accepted.csv
```

## Run austraits-api locally

Clone, build the dataset, then run the [austraits-api](https://github.com/traitecoevo/austraits-api) locally. This will
provide the default endpoints required by the TraitsFetcher tool:
- `http://localhost:8000/trait-count`
- `http://localhost:8000/trait-summary`
- `http://localhost:8000/download-taxon-data`

## Build

```shell
mvn package
```

## Run

```shell
java -jar target/taxon-traits-0.0.1-SNAPSHOT-jar-with-dependencies.jar ./config.json
```

## Configuration

| Key | Description | Default |
|-----|-------------|---------|
| `austraitsUrl` | Base URL for the AusTraits API | required |
| `acceptedCsv` | Path to accepted.csv | required |
| `traitsDir` | Root output directory | required |
| `traitsThreads` | Concurrent fetch threads | `5` |
| `kingdomFilter` | Comma-separated kingdoms to include | `Plantae` |

Example `config.json`:
```json
{
  "austraitsUrl": "http://localhost:8000",
  "acceptedCsv": "/data/taxon-traits/accepted.csv",
  "traitsDir": "/data/taxon-traits",
  "traitsThreads": 10,
  "kingdomFilter": "Plantae"
}
```

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

Successfully tested with 10 threads, with austraits data version 7.0.0, austraits-api 
[this commit](https://github.com/traitecoevo/austraits-api/commit/c9c936c7c471317c48abd7fdd15e26d324467916), locally. 
Runtime approximately 1hr.
