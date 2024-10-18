TODO: Move to ala-name-matching (the next project up the dependency tree), see https://github.com/AtlasOfLivingAustralia/ala-name-matching/issues/229

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

TODO: There is a new groups.json. It is added to search-service. Some inconsistencies will exist with production and test environments until the new groups.json deployed elsewhere.    
```
wget -O "/data/ala-namematching-service/config/groups.json" "https://raw.githubusercontent.com/AtlasOfLivingAustralia/ala-install/master/ansible/roles/namematching-service/files/groups.json"
wget -O "/data/ala-namematching-service/config/subgroups.json" "https://raw.githubusercontent.com/AtlasOfLivingAustralia/ala-install/master/ansible/roles/namematching-service/files/subgroups.json"
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

# Species Groups and testing search-service against namematching-service

There is one additional export, `lsid-speciesGroups.csv`, that on its own, or in combination with a modified 
ExtractAppliation (uncomment the relevant code), can be used to test the search-service against the namematching-service.

Noted differences and resolutions:
- namematching-ws will do an additional name search. To accommodate, rename kingdom "Protozoa" with the accepted "PROTISTA".
- namematching-ws will do an internal search to match "class:Agnatha" with "informal:Agnatha". To accommodate, add 2nd 
Fishes group in the speciesGroups.json where the rank is "informal" and the "include" has "Agnatha".

TODO: repeat the comparison when speciesGroups.json is changed.
