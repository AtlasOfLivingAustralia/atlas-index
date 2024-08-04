# Sandbox integration

Also see [local deploy info](/sandbox/README.md).

## Current state
Sandbox installation requires/depends on; SOLR, Cassandra, biocache-store, biocache-service, sandbox-hub, sandbox, collectory, ala-hub.

In addition to standalone use, it is used by spatial-service and spatial-hub.

## Future state
Sandbox will be replaced by a minimal replacement, backed by pipelines instead of biocache-store. 
- New collection in exiting SOLR Cloud (sandbox)
- New database in existing Cassandra (sandbox)
- Deploy of biocache-service using these.
- Deploy of ala-hub using this biocache-service.
- Basic interaction using of default-ui's sandbox upload/my uploads pages as well as an admin page.
- Basic interaction using spatial-hub.

## Progress
- [ ] Add the ability to set the `datasetName`.
- [x] Default UI component to upload a file for the sandbox and observe processing progress.
- [ ] Default UI pages; upload to sandbox, my uploads, admin. Ability to list and delete uploads.
- [x] Sandbox upload processing services.
- [ ] Document the dataset size vs memory requirements for pipelines.jar.
