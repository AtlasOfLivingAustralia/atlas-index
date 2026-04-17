# taxon-map

Generates cached map images for species pages, replacing live Leaflet tile loading with pre-rendered static PNGs.

## Purpose

For each accepted taxon GUID in the configured CSV, renders:

| File                                     | Contents                                                                           |
|------------------------------------------|------------------------------------------------------------------------------------|
| `{encodedGuid}_map.json`                 | Consolidated metadata: all zooms, layer list, bbox, attribution, occurrence count  |
| `{encodedGuid}_{zoomId}_occurrences.png` | Occurrence WMS layer (always regenerated when counts/distributions change)         |
| `{zoomId}_base.png`                      | Shared base OSM map (one per zoom, not per taxon; skipped if exists)               |
| `{encodedGuid}_{zoomId}_dist_{N}.png`    | Expert distribution layer (skipped if exists)                                      |

Output

- base files written to `{outputDir}/`
- taxon specific files written to `{outputDir}/{last2EncodedChars}/`

## Output layout

```
{outputDir}/{shard}/{encodedGuid}_map.json
{outputDir}/{zoomId}_base.png
{outputDir}/{shard}/{encodedGuid}_{zoomId}_occurrences.png
{outputDir}/{shard}/{encodedGuid}_{zoomId}_dist_{geomIdx}.png
```

## Zooms

Each entry in `config.json → zooms` carries two complementary pieces of information:

| Field  | Purpose                                                                                                                                               |
|--------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| `zoom` | Leaflet tile zoom level — controls which OSM tiles are fetched and how the canvas is centred. Matches `VITE_MAP_DEFAULT_ZOOM` in search-ui.           |
| `bbox` | Target geographic extents `[minLon, minLat, maxLon, maxLat]` — stored in the metadata as `targetBbox` so the UI can make cropping/fitting decisions.  |

The rendered canvas is always centred on `mapCentreLat`/`mapCentreLng` (or per-entry `centreLat`/`centreLng`). Its
actual geographic coverage (stored as `canvasBbox` in the metadata) will generally be wider than `targetBbox` —
`targetBbox` is the region of interest, not a render constraint.

```json
 "zooms": [
{"id": "aus", "label": "Australia", "zoom": 4, "bbox": [112, -44, 154, -9]},
{"id": "region", "label": "Region", "zoom": 3, "bbox": [102, -54, 164, 1]},
{"id": "world", "label": "World", "zoom": 1, "bbox": [-180, -90, 180, 90]}
]
```

An optional `centreLat`/`centreLng` per entry overrides the global centre. Add more entries as needed.

## Dependencies

Get the accepted names CSV (same file used by taxon-descriptions and taxon-traits):

```shell
curl "https://{search-service}/v1/bie/download?q=-acceptedConceptID:*%20AND%20idxtype:TAXON&fields=guid,scientificName,rk_genus,rk_family,rk_order,rk_class,rk_phylum,rk_kingdom" -o /data/search-service/data/accepted.csv
```

## Build

```shell
mvn package
```

## Run

One of the three count-source flags is **required**:

```shell
java -jar target/taxon-map-0.0.1-SNAPSHOT-jar-with-dependencies.jar ./config.json \
  --bie-counts|--biocache-counts|--previous-counts \
  [--skip-existing] [--verbose]
```

| Flag                | Description                                                                                      |
|---------------------|--------------------------------------------------------------------------------------------------|
| `--bie-counts`      | Fetch occurrence counts from the BIE v1 download API (bulk CSV, fast)                           |
| `--biocache-counts` | Fetch occurrence counts from biocache in batches of 1000 via the facets API                     |
| `--previous-counts` | Load occurrence counts from `occurrenceCountsCsv` (written by a previous run); falls back to biocache if the file is missing |
| `--skip-existing`   | Skip taxa whose metadata JSON already exists and all occurrence PNGs are present                 |
| `--verbose`         | Log each new/updated taxon with occurrence count and distribution diff; log each distribution image fetched |

### Count-source details

**`--bie-counts`** — calls `GET {bieUrl}/v1/bie/download` with `q=-acceptedConceptID:*`, `fq=idxtype:TAXON`, `fq=occurrenceCount:[1 TO *]`, `fields=guid,occurrenceCount`. Returns a CSV directly. Fastest option for a full refresh.

**`--biocache-counts`** — POSTs `lsid:(guid1 OR guid2 …)` queries to `{biocacheUrl}/occurrences/search` in batches of 1 000 using the `lsid` facet.

**`--previous-counts`** — reads the CSV written by a previous run (path = `occurrenceCountsCsv` config key). Use when re-running after a partial failure to avoid re-fetching all counts. Falls back to biocache if the file is missing.

After any live fetch the results are written to `occurrenceCountsCsv` (if configured) so they can be reused with `--previous-counts`.

## Change detection

On each run the tool reads the existing `_map.json` for each taxon and compares:

1. **Occurrence count** — if unchanged and all occurrence PNGs are present, the taxon is skipped.
2. **Distribution geomIdx set** — if the set of expert-distribution geomIdx values has changed (additions or removals), the taxon is regenerated.

With `--verbose`, changed taxa are logged:

```
12:34:56:789 update {guid}; occCount 1234 -> 5678;
12:34:56:789 update {guid}; dist +[geomIdx1]; dist -[geomIdx2];
12:34:56:789 new {guid}; occCount 5678; dist 2
```

## Configuration

| Key                    | Description                                                        | Default                              |
|------------------------|--------------------------------------------------------------------|--------------------------------------|
| `biocacheUrl`          | Biocache WS base URL                                               | required                             |
| `bieUrl`               | BIE service base URL (for BIE counts and distributions lookup)     | optional                             |
| `spatialUrl`           | Spatial portal base URL                                            | required                             |
| `osmZxyUrl`            | OSM tile URL template (`{z}/{x}/{y}`)                              | required                             |
| `globalFq`             | Global filter query appended to biocache requests (starts with `&`) | `""`                                |
| `outputDir`            | Root output directory                                              | required                             |
| `acceptedCsv`          | Path to accepted.csv                                               | required                             |
| `occurrenceCountsCsv`  | Path to persist/restore occurrence counts CSV                      | optional                             |
| `threads`              | Number of concurrent worker threads                                | `2`                                  |
| `userAgent`            | HTTP User-Agent header                                             | `taxon-map/1.0 (support@ala.org.au)` |
| `imageWidth`           | Output image width in pixels                                       | `870`                                |
| `imageHeight`          | Output image height in pixels                                      | `530`                                |
| `mapLayerOpacity`      | Opacity for the occurrence layer (0–1)                             | `0.7`                                |
| `mapCentreLat`         | Default map centre latitude (mirrors `VITE_MAP_CENTRE_LAT`)        | `-28`                                |
| `mapCentreLng`         | Default map centre longitude (mirrors `VITE_MAP_CENTRE_LNG`)       | `133`                                |
| `mapDefaultZoom`       | Default tile zoom level (mirrors `VITE_MAP_DEFAULT_ZOOM`)          | `4`                                  |
| `hexBinColours`        | Array of `[hexColour, breakCount\|null]`                           | see config.json                      |
| `zooms`                | Array of `{id, label, zoom, bbox, centreLat?, centreLng?}` objects | australia + world                    |

Example `config.json`:

```json
{
  "biocacheUrl": "https://biocache-ws.ala.org.au/ws",
  "bieUrl": "https://bie.ala.org.au",
  "spatialUrl": "https://spatial.ala.org.au",
  "osmZxyUrl": "https://spatial.ala.org.au/osm/{z}/{x}/{y}.png",
  "globalFq": "&qualityProfile=ALA",
  "outputDir": "/data/search-service/data/taxon-map",
  "acceptedCsv": "/data/search-service/data/accepted.csv",
  "occurrenceCountsCsv": "/data/search-service/data/occurrence-counts.cache",
  "threads": 2,
  "imageWidth": 870,
  "imageHeight": 530,
  "mapLayerOpacity": 0.7,
  "mapCentreLat": -28,
  "mapCentreLng": 133,
  "mapDefaultZoom": 4,
  "hexBinColours": [
    ["FFC577", 1],
    ["E28946", 10],
    ["D36B3D", 100],
    ["C44D34", 1000],
    ["802937", null]
  ],
  "zooms": [
    {
      "id": "aus",
      "label": "Australia",
      "zoom": 4,
      "bbox": [112, -44, 154, -9]
    },
    {
      "id": "region",
      "label": "Region",
      "zoom": 3,
      "bbox": [102, -54, 164, 1]
    },
    {
      "id": "world",
      "label": "World",
      "zoom": 1,
      "bbox": [-180, -90, 180, 90]
    }
  ]
}
```

## Progress and restartability

The tool logs progress every 100 taxa:

```
12:34:56:789 processed=100 skipped=20 written=240 errors=1
```

- **processed** — total taxa attempted
- **skipped** — taxa skipped (no change detected or `--skip-existing`)
- **written** — new files written this run
- **errors** — processing failures (logged with taxon details)

Re-running with `--skip-existing` will skip any taxon whose metadata JSON exists and all occurrence PNGs are present.

Use `--previous-counts` on subsequent runs (with `occurrenceCountsCsv` configured) to avoid re-fetching all occurrence counts, saving time if restarted unexpectedly.

## Search-UI integration

Set the following environment variable in `search-ui/.env.local` (or `.env.production`):

```properties
VITE_TAXON_MAP_URL=https://static.ala.org.au/taxon-map
```

When set, the species map tab will render the cached PNGs instead of live Leaflet tiles.
The default zoom to display is `australia`; a zoom selector will appear if more than one zoom is available in the
metadata.
