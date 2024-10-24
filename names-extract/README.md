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
ExtractAppliation. To enable a comprehensive test between elasticsearch and name matching service, see the 3 ExtractApplication.java `TODO` statements to enable and configure this test.

Noted differences that require additional configuration in the species groups file:
- namematching-ws will do an additional name search. This means that the species groups file must be accurate.
- namematching-ws will do an internal searches. This is not implied by the configuration file and results in some entries having >1 rank. To accommodate multiple ranks for a single group, duplicate the group for the "includes" of the other rank.

TODO: The existing species groups required minor changes (see git history of this file). The proposed changes have some outstanding issues, see https://github.com/AtlasOfLivingAustralia/ux-ui/issues/162. After these are resolved, repeat the comprehensive species group testing.
