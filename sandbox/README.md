# Sandbox for search-service

## Purpose

A minimal replacement for the existing sandbox, backed by pipelines instead of biocache-store.

## Requirements

Requires a locally built shaded pipelines jar. Build using this branch https://github.com/gbif/pipelines/tree/1084-living-atlas.

## Usage (local environment)
1. Prepare search-service, default-ui, and dependencies.
2. Prepare SOLR Cloud (includes Zookeeper) `cd sandbox/solr-docker; docker-compose up -d`.
3. Prepare files, e.g.
```
/data/sandbox/uploads // For uploaded files.
/data/sandbox/processed // For temporary files, should be automatically deleted after success or failure.
/data/la-pipelines/bin/pipelines-2.19.0-SNAPSHOT-shaded.jar // The pipelines jar.
/data/la-pipelines/config/la-pipelines.yaml // The pipelines properties.
```
4. Update search-service configuration, e.g.
```properties
# pipelines and sandbox configuration
pipeline.cmd=/opt/homebrew/opt/openjdk@11/bin/java -Dspark.local.dir=/data/sandbox/tmp -Djava.io.tmpdir=/data/sandbox/tmp -cp /data/src/pipeline2/pipelines/livingatlas/pipelines/target/pipelines-2.19.0-SNAPSHOT-shaded.jar
pipelines.config=--config=/data/la-pipelines/configs/la-pipelines.yaml
zk.hosts=localhost:9983
solr.collection=biocache
solr.url=http://localhost:8983/solr/biocache
sandbox.consumer.threads=1
sandbox.dir=/data/sandbox
```

This is sufficient for local development as SOLR can be inspected after a successful upload.

## Usage (test environment)
1. Prepare Cassandra (for biocache-service)
2. Prepare biocache-service using this cassandra and SOLR Cloud.
3. Prepare ala-hub using this biocache-service.
