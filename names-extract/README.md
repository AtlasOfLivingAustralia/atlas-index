TODO: Move to ala-namematching-service (the next project up the dependency tree)

# Purpose
The names index DwCA is missing useful information that exists in the names index lucene. This projects extracts 
information into CSV files.

## biocache-service benefits
- Faster startup time.
- Small memory requirement.
- Faster responses.

## bie-index (refactored) benefits
- Faster index generation.
- Consistency with ala-namematching-service.
- Faster occurrence count and image updates.

# Usage

Build

```shell
mvn package
```

Required files, copy from github

```
wget -O "/data/ala-namematching-service/groups.json" "https://raw.githubusercontent.com/AtlasOfLivingAustralia/ala-install/master/ansible/roles/namematching-service/files/groups.json"
wget -O "/data/ala-namematching-service/subgroups.json" "https://raw.githubusercontent.com/AtlasOfLivingAustralia/ala-install/master/ansible/roles/namematching-service/files/subgroups.json"
```

Run
```shell
java -Dlucene.dir=/data/lucene/namematching-20230725-5/ -jar target/names-extract-0.0.1-SNAPSHOT-jar-with-dependencies.jar server
```

Produces
```shell
./lsid-left-right.csv
./lsid-vernacularName.csv
```

Copy the outputs to the appropriate locations
```
dwca.extract.leftRightCsvPath=/data/search-service/lsid-left-right.csv
dwca.extract.commonNamePath=/data/search-service/lsid-vernacularName.csv
```

# Outputs

## CSV of id, left, right
These are the left and right values as determined by ala-namematching-service.

This enables local access to left & right values.

## CSV of id, preferred common name
The preferred common name is as determined by ala-namematching-service.

This enables consistency between bie-index and ala-namematching-service that is used by pipelines.

