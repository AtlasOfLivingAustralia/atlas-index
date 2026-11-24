# atlas-index CI/CD

AWS CodePipeline definitions for the `*-ui` apps and `search-service`, modelled on
[species-lists/cicd](https://github.com/AtlasOfLivingAustralia/species-lists/tree/main/cicd). Everything a deploy
needs lives in this folder; nothing is read from ansible-inventories, aws-inventories or ala-cli at deploy time.

## TL;DR

- **What:** one CodePipeline per app (8 UIs and search-service), plus `base` and `database` pipelines. A merge to
  `develop` deploys only the apps it touches to **testing**, in the species-lists testing AWS account.
- **Where:** temporary `*-cicd` hostnames (e.g. `bie-cicd.test.ala.org.au`, `service-cicd.test.ala.org.au`), side by
  side with the legacy deployment until each app is cut over.
- **UIs:** S3 + CloudFront per UI. Jest, then Playwright in chromium, firefox and webkit against mocked APIs, must
  pass before anything is published.
- **search-service:** tested, built into an image and deployed with Helm on the shared regolith EKS cluster. It uses
  the shared regolith Elasticsearch (its own indexes) and RabbitMQ (its own virtual host), its own Aurora
  PostgreSQL database, and Cognito clients created by the base stack.
- **Status:** written and checked locally (lint, Helm render, Playwright gate against real suites); nothing is
  deployed yet. Before the first deploy, work through [First-time setup](#first-time-setup). Still open:
  [DG-6 and DG-9](#decision-gates).

- [Overview](#overview)
- [How it works](#how-it-works)
- [The Playwright gate](#the-playwright-gate)
- [First-time setup](#first-time-setup)
- [Day to day](#day-to-day)
- [Hostnames and the legacy cutover](#hostnames-and-the-legacy-cutover)
- [Architectural decisions](#architectural-decisions)
- [Decision gates](#decision-gates)
- [Verify on the first AWS run](#verify-on-the-first-aws-run)

## Overview

| Pipeline (per environment) | Component | Deploys | Runs on pushes to |
|---|---|---|---|
| `atlas-index-base-<env>` | [base](base) | CloudFront WAF (us-east-1), Playwright reports bucket, Playwright build image, Cognito clients | `cicd/base/**`, `cicd/*`, `yarn.lock`, `.nvmrc` |
| `atlas-index-database-<env>` | [database](database) | Aurora PostgreSQL Serverless v2 for search-service, and its login secret | `cicd/database/**`, `cicd/*` |
| `atlas-index-<ui>-<env>` (×8) | [frontend](frontend) | S3 + CloudFront + Route 53 per UI | `<ui>/**`, `common-ui/**`, `static-server/**`, root Yarn files, `cicd/frontend/**` (own UI only), `cicd/*` |
| `atlas-index-search-service-<env>` | [backend](backend) | ECR image, regional WAF, Helm release on the regolith EKS cluster | `search-service/**`, `cicd/backend/**`, `cicd/*` |

Environments come from the branch ([branch_2_env.py](branch_2_env.py)):

| Branch | Environment | Deploys |
|---|---|---|
| `develop` | testing | automatically on push |
| `main`/`master` | staging, or production with `-e prod` | staging automatically; production manual (`AUTO_DEPLOY = false`) |
| anything else | development (per-branch stacks) | after you deploy its pipelines |

Only testing is in scope for now. The root and backend configs have staging and production sections, but the UI
configs don't yet, and those environments aren't enabled; see [DG-9](#decision-gates).

```
cicd/
  config.ini                  product-wide settings and hostnames, one section per environment
  branch_2_env.py clean_branch.sh gen_env_vars.py gen_template_config.py fingerprint.sh
  deploy_pipeline.sh          create/update any pipeline stack
  export_config.sh            shared body of every ExportConfig action
  render_template_configs.sh  CloudFormation template configs from *_template_config.j2
  deploy_notification_buildspec.yaml empty_bucket_buildspec.yaml dd_notification.sh slack_notification.sh
  base/      config.ini  app/{base,waf}.yaml  playwright/{Dockerfile,build_image.sh}  pipeline/
  frontend/  config.ini  <ui>/config.ini  app/site.yaml  scripts/  pipeline/
  database/  config.ini  app/database.yaml  pipeline/
  backend/   config.ini  app/{ecr,waf}.yaml  search-service-config.properties.j2  scripts/  pipeline/
search-service/helm/          Helm chart used by the backend pipeline
```

## How it works

**Config layering.** [gen_env_vars.py](gen_env_vars.py) reads `cicd/config.ini`, then the component's
`config.ini`, then (for UIs) `frontend/<ui>/config.ini`. Later files win, and the section is the environment. Values
use `${KEY}` interpolation. The output is shell-quoted (`--shell`) so values containing spaces or HTML can be
sourced safely.

**Decision gates.** A value containing `TODO-DG<n>` stops the ExportConfig action with a pointer to the gate, so a
pipeline can't deploy half-configured. See [Open decision gates](#decision-gates).

**Self-updating pipelines.** As in species-lists, each pipeline stack records a fingerprint: the md5 of its
`pipeline.yaml`. If ExportConfig finds a different fingerprint in the commit being deployed, it redeploys the pipeline and stops. A normal deploy then
restarts itself; a rollback has to be started manually.

**Selective deploys and tests.** Each app has its own pipeline whose CodePipeline V2 trigger lists the paths it
depends on, and a UI pipeline only ever runs that UI's tests:

| Change | Pipelines that run | Playwright suites that run |
|---|---|---|
| `search-ui/**` (code, tests or config) | search-ui | search-ui |
| `cicd/frontend/search-ui/**` | search-ui | search-ui |
| `common-ui/**`, `yarn.lock`, `package.json`, `.yarnrc.yml`, `.yarn/**`, `.nvmrc` | all 8 UIs | all 8, each in its own pipeline |
| `static-server/**` | all 8 UIs | all 8 (the specs read its header, footer and CSS from disk) |
| shared CI/CD files (`cicd/*`, `cicd/frontend/{app,pipeline,scripts}/**`) | all 8 UIs (plus base/backend for `cicd/*`) | all 8 |
| `search-service/**` | search-service only | none (the UI specs mock the API) |
| `*.md` anywhere | none | none |

The fan-out cases are deliberate: every UI bundles `common-ui` and resolves through the shared lockfile, and every
UI's specs load `static-server` content, so a change there can break any of them. Within a run, the UI's whole
suite runs rather than only the specs touched by the commit. That takes 15 s to about 2 min, and it catches
regressions that the commit's own specs wouldn't. UIs don't import each other: `@ala/common-ui` is the only
workspace dependency.

**UI build config.** Vite bakes `VITE_*` into the bundle at build time, so each environment gets its own build.
ExportConfig writes `<ui>/.env.production` from the `VITE_*` keys in the layered config. Never put a secret in a
`VITE_*` value: every one ends up public in the bundle.

**UI pipeline stages**

1. `Checkout_Source`
2. `Deploy_Infrastructure`: ExportConfig, then the site stack ([site.yaml](frontend/app/site.yaml)): private S3
   bucket with OAC, CloudFront with SPA fallback and the shared WAF, and a Route 53 alias.
3. `Build_and_Test`:
   - `BuildRelease` (common-ui and UI Jest tests, then `yarn build` with the generated `.env.production`) runs in
     parallel with `BuildPlaywrightBundle`.
   - Then the `PlaywrightTests` gate.
4. `Publish` ([publish.sh](frontend/scripts/publish.sh)):
   - Hashed `assets/` are uploaded first, cached as immutable.
   - Other files follow, then `index.html` last with `no-cache`.
   - Assets superseded more than `ASSET_RETENTION_DAYS` ago are pruned.
   - CloudFront is invalidated, then the deploy notification is sent.
5. `Teardown` (development only, behind manual approvals).

UI build steps use the Playwright build image from the base stack (Node from `.nvmrc`, corepack, the `canvas`
toolchain and the AWS CLI). Dependencies are installed with `yarn workspaces focus <ui> @ala/common-ui` under the
repository's immutable, scripts-off Yarn config. The Yarn cache is kept in S3.

**search-service pipeline stages**

1. `Checkout_Source`
2. `Deploy_Infrastructure`: ExportConfig, then the ECR and regional WAF stacks.
3. `Test_and_Build`:
   - `mvn verify` in privileged mode for Testcontainers, with JUnit results as a CodeBuild report.
   - A multi-arch image: Maven runs once on the build platform, and only the JRE layer is per-architecture.
     Tagged `<branch>-<build>` and `latest`.
4. `Deploy` ([deploy_helm.sh](backend/scripts/deploy_helm.sh)):
   - Renders [search-service-config.properties.j2](backend/search-service-config.properties.j2), then appends the
     credentials it looks up: the database login (database stack secret), the Cognito client IDs and the
     machine-to-machine client secret (base stack), the shared Elasticsearch and RabbitMQ logins, and every
     key/value of the Secrets Manager secret `APP_SECRET_NAME`. This happens inside the deploy build, so
     credentials never reach a pipeline artifact.
   - Reads the shared Elasticsearch's self-signed CA from Kubernetes, and the chart adds it to the pod's Java
     truststore.
   - Runs `helm upgrade --install --wait` with [search-service/helm](../search-service/helm), then smoke-tests
     `https://<service host>/actuator/health`, then sends the deploy notification.
5. `Teardown` (development only).

## The Playwright gate

The gate runs inside the pipeline, on AWS, before `Publish`:

1. `BuildPlaywrightBundle` builds the instrumented `build:playwright` bundle once
   ([playwright_bundle.sh](frontend/scripts/playwright_bundle.sh)). It mirrors each UI's `run-playwright-test.sh`
   quirks: specimens-ui swaps in the test `collections.json`, regions-ui copies `regionsList.json`, and search-ui
   also builds a licence-filter variant.
2. `PlaywrightTests` ([playwright_test.sh](frontend/scripts/playwright_test.sh)) runs in one LARGE container:
   - Serves the bundle with `vite preview` on `:5173`, the port baked into `.env.playwright`, and runs every
     browser in `PLAYWRIGHT_BROWSERS` against it. Every backend is mocked by the specs, so nothing else runs.
   - Then runs the variant spec against the variant build, if the UI has one.
   - Merges both runs into one HTML report (published to S3) and one JUnit report (a CodeBuild report).
   - **Fails the pipeline** if any test failed. The report is still published when it does.
   - A 30-minute global timeout turns a hang (e.g. a browser that never launches) into a failure.

Reports are kept at `s3://<reports bucket>/<ui>/<pipeline execution id>/html-report/`. The action log prints a 7-day
link to the summary and the command to view the full report with traces:

```shell
aws s3 sync s3://<reports bucket>/<ui>/<execution id>/html-report/ report && npx playwright show-report report
```

**Tuning.** `PLAYWRIGHT_BROWSERS` and `PLAYWRIGHT_WORKERS` are in `frontend/config.ini`; a UI's `config.ini` can
override them. Measured local runs:

| Suite | Run | Time |
|---|---|---|
| search-ui (117 tests per browser) | chromium / webkit alone, 4 workers | 52 s / 58 s |
| search-ui | chromium + webkit + variant together, 6 workers | 1.5 min (236 tests) |
| occurrence-ui (182 tests per browser) | chromium alone, 4 workers | 1.7 min |
| sds-ui (13 tests per browser) | chromium + webkit together, 6 workers | 15 s |

So the whole gate is a few minutes per UI, which is why there's no sharding (see AD-4). If a suite grows past
roughly 10 minutes, split it across containers again.

**Playwright upgrades.** The base pipeline builds `atlas-index-playwright:pw<version>-node<major>-<hash>` from
[base/playwright/Dockerfile](base/playwright/Dockerfile) whenever the `@playwright/test` version in `yarn.lock`, the
Node major in `.nvmrc`, or the Dockerfile changes, and moves `:latest` to it. The build fails if the workspaces
resolve more than one Playwright version. If a UI pipeline runs before the new image exists, the gate installs the
matching browsers itself.

**Running it locally.** `<ui>/run-playwright-test.sh` is unchanged. The CI scripts can be run from the repository
root with the env vars documented at the top of each script.

## First-time setup

Nothing below is created by the pipelines. Work through it once per account and environment, in order.

### 1. Account prerequisites (shared ALA platform; check rather than create)

- [ ] The stacks named in [config.ini](config.ini) exist and export what the pipelines import:
  - `ala-bedrock-cicd-bootstrap-production`: `-CodeBuildServiceRoleArn`, `-CodePipelineServiceRoleArn`,
    `-CloudFormationServiceRoleArn`, `-CodestarConnectionArn`.
  - `ala-bedrock-cicd-buckets-production`: `-<region>-CodePipelineArtifactBucketName`. The us-east-1 artifact
    bucket in `US_EAST_ARTIFACT_BUCKET` must also exist, for the base WAF stack.
  - The common WAF rule-group stack for the environment.
  - `ala-regolith-cluster-<env>`: `-ClusterName`.
- [ ] The CodeStar/GitHub connection is authorised for `AtlasOfLivingAustralia/atlas-index`. The GitHub app
  installation must include this repository.
- [ ] The species-lists testing certificates in [config.ini](config.ini) (`CLOUDFRONT_CERTIFICATE` in **us-east-1**,
  `APP_CERTIFICATE` in ap-southeast-2) are `*.test.ala.org.au` wildcards, so they cover the `*-cicd` hostnames.
  The `test.ala.org.au` zone is in this account: CloudFormation adds the UI records, and external-dns adds
  `service-cicd`.
- [ ] The testing Cognito pool (`ala-cognito-pool-testing`) exports `-UserPoolId`, and has the resource-server
  scopes (`ala/*`, `users/read`) and identity providers (Facebook, Google, AAF, SignInWithApple) that species-lists'
  clients use.
- [ ] The `ala-bedrock-vpc-production` stack exports `-Vpc`, `-VpcCidr` and `-PriSubnets`, as species-lists'
  database uses.
- [ ] `ala-secrets-production` has `datadog-api-key` and `slack-oauth-token`, as used by species-lists, and the
  Slack channel in `SLACK_ALERT_CHANNEL` exists.

### 2. IAM (bootstrap roles)

Species-lists already uses most of these. The CodeBuild role must allow:

- [ ] `cloudformation:DescribeStacks` in **us-east-1** (UI pipelines read the base WAF ARN).
- [ ] S3 read/write on the reports bucket created by the base stack, and on the site buckets (`ala-atlas-index-*`).
- [ ] `cloudfront:CreateInvalidation`.
- [ ] ECR push to `atlas-index-playwright-*` and `atlas-index-search-service-*`, plus `ecr:GetAuthorizationToken`.
- [ ] `secretsmanager:GetSecretValue` on `ala-atlas-index-search-service-*`, `ala-atlas-index-database-*` and the
  shared `ala-regolith-<env>-elasticsearch` and `ala-regolith-<env>-rabbitmq` secrets.
- [ ] `cognito-idp:DescribeUserPoolClient` on the testing pool (to read the machine-to-machine client secret).
- [ ] CodeBuild test reports (`codebuild:CreateReportGroup`, `CreateReport`, `UpdateReport`, `BatchPutTestCases`).
  Without these the JUnit tab stays empty, but the gate still works.
- [ ] `eks:DescribeCluster`, and an EKS access entry (or `aws-auth` mapping) that lets the role manage the
  `EKS_NAMESPACE` namespace (`testing`) and **read** the secret `testing-cluster-es-http-certs-public` in the
  `elasticsearch` namespace.

The CloudFormation role must be able to create S3 buckets and policies, CloudFront distributions and OACs, Route 53
records, WAFv2 web ACLs and logging, ECR repositories, log groups, Cognito user pool clients, Secrets Manager
secrets, EC2 security groups, and RDS subnet groups, clusters and instances.

### 3. Cluster (regolith)

- [ ] The AWS Load Balancer Controller and external-dns run and manage `HOSTED_ZONE`.
- [ ] The `auto-ebs-sc` storage class exists, and the `testing` namespace exists.
- [ ] Create the RabbitMQ virtual host on the shared broker. search-service's queue names are fixed, so a separate
  virtual host is what keeps it from taking the legacy test service's tasks. Once per environment (and per
  development branch, using `atlas-index-<branch>`):

  ```shell
  kubectl exec -n rabbitmq testing-server-0 -- rabbitmqctl add_vhost atlas-index-testing
  kubectl exec -n rabbitmq testing-server-0 -- rabbitmqctl set_permissions -p atlas-index-testing \
    <username from the ala-regolith-testing-rabbitmq secret> '.*' '.*' '.*'
  ```

### 4. search-service secrets and data

The pipelines create the database, its password and the Cognito clients, and the deploy looks up every credential
it needs. Two things are left:

- [ ] Create the JSON secret `ala-atlas-index-search-service-<env>` (`APP_SECRET_NAME`) for any further secret
  search-service properties, e.g. `{"bhl.apikey": "…"}`. An empty `{}` is fine.
- [ ] After the first backend deploy, put the import data on the data volume: `import/` (the names DwCA) plus
  `lsid-left-right.csv` and `lsid-vernacularName.csv` from names-extract, under `/data/search-service/import-data/`.
  To have the pod sync it from S3 instead, set `DATA_S3_URI` and `SERVICE_ROLE_ARN` (an IRSA role with read access)
  in [backend/config.ini](backend/config.ini).

### 5. Repository decisions

- [ ] DG-6: check each `cicd/frontend/<ui>/config.ini` against the legacy deployment.
- [ ] Add the `*-cicd` UI hosts to the Google Maps key's HTTP referrer restrictions (the key is in
  [frontend/config.ini](frontend/config.ini); it is a public browser key).
- [ ] Merge `feature/cicd` into `develop`. The testing pipelines deploy from `develop`.

### 6. Deploy the pipelines

With AWS credentials for the account, from a clean, pushed checkout of `develop`. Base goes first: it provides the
WAF, the reports bucket, the build image and the Cognito clients that the others use. The database must exist
before the backend deploys.

```shell
cicd/deploy_pipeline.sh -c base        # wait for its first run to finish (it builds the Playwright image)
cicd/deploy_pipeline.sh -c database    # wait for its first run (the cluster takes ~10 minutes)
cicd/deploy_pipeline.sh -c backend
for ui in admin-ui dashboard-ui doi-ui occurrence-ui regions-ui sds-ui search-ui specimens-ui; do
  cicd/deploy_pipeline.sh -c frontend -u "$ui"
done
```

Rolling out in waves (dashboard, sds, regions → specimens, doi, admin → search, occurrence) makes cost and
flakiness easier to watch.

### 7. After the first deploy

- [ ] Build the search index: in admin-ui (`admin-cicd`), run the import and index tasks, as on the legacy server.
- [ ] Open each `-cicd` site, log in and out, and check the browser console for CORS or mixed-host errors.
- [ ] Work through [Verify on the first AWS run](#verify-on-the-first-aws-run).

## Day to day

- **Deploy to testing:** merge to `develop`. Only the affected pipelines run.
- **Re-run a deploy:** "Release change" on the pipeline. A later push doesn't retry a failed UI unless it touches
  that UI's paths.
- **Change a pipeline** (its `pipeline.yaml`): commit and push. The pipeline redeploys itself. Config changes
  (`config.ini` files, including Playwright browsers and workers) are picked up by the next run.
- **Roll back:** check out the old commit, run `cicd/deploy_pipeline.sh -c <component> [-u <ui>] -b <branch>`, then
  start the pipeline manually. It won't restart itself.
- **Tear down a development branch:** enable the `Teardown` stage transition and approve.

## Hostnames and the legacy cutover

Until the legacy deployment (manually published S3 sites and the EC2 search-service) is decommissioned, every
hostname carries `DOMAIN_SUFFIX = -cicd` ([config.ini](config.ini)):

| App | Legacy (testing) | AWS (testing) | AWS (production, later) |
|---|---|---|---|
| search-ui | bie.test.ala.org.au | bie-cicd.test.ala.org.au | bie-cicd.ala.org.au |
| dashboard-ui | dashboard.test.ala.org.au | dashboard-cicd.test.ala.org.au | dashboard-cicd.ala.org.au |
| admin-ui | admin.test.ala.org.au | admin-cicd.test.ala.org.au | admin-cicd.ala.org.au |
| regions-ui | regions.test.ala.org.au | regions-cicd.test.ala.org.au | regions-cicd.ala.org.au |
| specimens-ui | specimens.test.ala.org.au | specimens-cicd.test.ala.org.au | specimens-cicd.ala.org.au |
| doi-ui | doi.test.ala.org.au | doi-cicd.test.ala.org.au | doi-cicd.ala.org.au |
| occurrence-ui | (ala-hub) | biocache-cicd.test.ala.org.au | biocache-cicd.ala.org.au |
| sds-ui | n/a | sds-cicd.test.ala.org.au | sds-cicd.ala.org.au |
| search-service | service.test.ala.org.au | service-cicd.test.ala.org.au | service-cicd.ala.org.au |

The hostnames feed every place that needs them:

- Route 53 records and CloudFront aliases (site stack).
- The ALB ingress and external-dns (Helm).
- Each UI's `VITE_APP_BASE_URL`, and `VITE_APP_API_URL` → `service-cicd`.
- Links between atlas-index apps, which stay inside the same environment.
- search-service `security.cors.origins`, `openapi.servers`, `sitemap.url` and `speciesUrlPrefix`.
- The Cognito login client's callback URLs (`service-cicd`'s `/callback` and every UI) and logout URLs (every UI).

Header, footer and other shared content keep coming from the existing ALA sites (`COMMON_UI_URL`, `STATIC_URL`).

**Cutover, one app at a time:**

1. Compare the `-cicd` app with the legacy one. `search-test` can diff service responses.
2. Register the legacy hostname with the OIDC client and add it to CORS.
3. CloudFront won't accept an alias that another distribution holds. Release it with
   `aws cloudfront associate-alias` (or remove it from the legacy distribution), then set the app's
   `DOMAIN_SUFFIX` to empty for that environment and deploy. This moves the alias and the Route 53 record.
4. Keep the `-cicd` name for one release as a rollback path. Then delete the legacy bucket, distribution and EC2
   host, and remove the `-cicd` names from DNS, CORS and OIDC.

## Architectural decisions

**AD-1 Selective deploys: one pipeline per app, using CodePipeline V2 path triggers.**
- Rejected: one monorepo pipeline with a git-diff stage. It needs custom diff logic, one broken app blocks the
  others, and history and rollback are shared.
- Rejected: CodeBuild webhooks (the earlier aws-inventories approach). They bypass pipeline stages and approvals.
- Path triggers need no code, match species-lists, and give each app its own history, rollback and teardown.
  Shared dependencies (`common-ui`, the root Yarn files, `static-server`) are listed explicitly so they fan out to
  every UI. CodePipeline allows 8 paths per filter, and the UI's first filter is now full; add a third filter
  (the maximum) if more shared paths appear.
- Each pipeline runs its UI's full suite rather than only the changed specs. Suites take minutes at most, and
  selecting specs by diff would miss regressions that reach a page through shared code.

**AD-2 Config: layered INI files in this repo, with secrets in Secrets Manager.**
- This removes the deploy-time dependency on the inventory repos and ala-cli, and reuses the species-lists tooling.
- `--shell` quoting fixes the species-lists `source env.txt` pattern, which breaks on values containing spaces or
  HTML.
- The `TODO-DG` guard turns open decisions into explicit pipeline failures instead of half-configured deploys.

**AD-3 Artifacts: build per environment, and gate on a separate instrumented bundle from the same commit.**
- ALA builds bake `VITE_*` in at build time; runtime `config.js` exists only for the LA Community profile, so a
  build can't be promoted between environments.
- Enabling runtime config for ALA builds was rejected as an app-code change.
- The gate tests the `build:playwright` bundle that the suites were written for, with mocked endpoints. The release
  build gets Jest and `tsc`.

**AD-4 Playwright on AWS: one container per UI runs every browser against the prebuilt bundle inside the pipeline;
the exit code is the gate.**

| Option | Wall-clock | AWS cost | Flakiness | Complexity |
|---|---|---|---|---|
| **One LARGE container, all browsers (chosen)** | container start + install + ~2 min of tests | lowest: one install | low with mocks; workers share 8 vCPUs | lowest |
| Batch matrix, one container per browser (or browser × shard) | about the same: container start and install dominate | ~3× the installs | lowest: isolated | medium: batch role, blob upload and a merge action |
| Temporary EC2/ECS app servers with remote runners | network latency | highest, plus infra lifecycle | network and teardown | highest |

- The mocks make a remote app server pointless.
- A browser × shard batch matrix was built and run first. Measured suites take 10 s to 1.7 min per browser, so
  extra containers bought no speed and added cost, a batch role dependency, and S3 blob/status plumbing.
- One container keeps one install, one merged report, and a plain exit-code gate. The report still names the
  failing browser.
- All three browsers run on every deploy (DG-8): the extra cost over a chromium-only gate was accepted.

**AD-5 Browsers: a prebuilt ECR image pinned to the lockfile's Playwright version, built by the base pipeline.**
- Rejected: `playwright install --with-deps` in every run. It adds minutes per run.
- Rejected: browsers cached in S3. The OS packages would still need installing.
- The same image serves every UI build step (Node 24, `canvas` toolchain), which the stock CodeBuild image doesn't
  provide. A version check falls back to installing the browser if the image lags behind `yarn.lock`.

**AD-6 Publish: CodeBuild `s3 sync` in order (immutable assets, then other files, then `index.html`), delayed
pruning, and CloudFront invalidation.**
- Rejected: species-lists' empty-bucket-then-upload. It leaves a window of 404s and breaks open sessions that try to
  load chunk hashes which no longer exist.

**AD-7 Hosting: one bucket and distribution per UI, one shared CloudFront WAF per environment, and OAC.**
- Each UI needs its own alias, SPA fallback, teardown and cutover.
- A shared WAF avoids eight web ACLs (species-lists also uses one WAF per product).
- OAC replaces the legacy OAI.

**AD-8 search-service: a container on the regolith EKS cluster via Helm, like the species-lists backend.**
- Tests gate the image, and a health smoke test after `--wait` gates the notification.
- Config goes into a Kubernetes Secret, rendered at deploy time.
- Data lives on a ReadWriteOnce volume with `Recreate`, so there is one replica and Flyway migrates on startup.
- `shortcut:` there's no migration-aware deploy (scale to 0 → snapshot → migrate → scale up, as prototyped in
  aws-inventories) yet. Add one before running more than one replica or enabling production.

**AD-9 Cutover: a single `DOMAIN_SUFFIX` setting.**
- The `-cicd` stack runs alongside the legacy one until each app is compared.
- The alias moves with `associate-alias`, and the old name is kept for one release as a rollback path.
- The `-cicd` service never writes to the legacy service's stores: it has its own indexes, RabbitMQ virtual host and
  database (AD-10).

**AD-10 search-service data: the shared regolith Elasticsearch and RabbitMQ, and its own Aurora PostgreSQL (DG-5).**
- Elasticsearch: the regolith cluster's Elastic-operator cluster (`testing-cluster`, `main-cluster` for
  staging/production), as species-lists uses. Login and TLS are on; the self-signed CA is copied from Kubernetes
  into the pod's truststore at deploy time. The indexes are `atlas-index-<env>-search` and `-search-log`, so they
  can't collide with the legacy test indexes in the same cluster.
- RabbitMQ: the regolith testing broker. search-service hard-codes its queue names (`consumer`, `broadcast`,
  leader), and the legacy test service uses the same broker, so this deployment gets its own virtual host. That
  needed one new setting in search-service (`rabbitmq.virtualHost`, default `/`, so existing deployments are
  unchanged).
- PostgreSQL: a `database` component like species-lists' DocumentDB one, using Aurora PostgreSQL Serverless v2
  (0.5–2 ACUs in testing). Serverless only, with capacity set per environment, avoids species-lists' second
  provisioned-instance path. The password is generated in Secrets Manager and never written down. Deleting the
  stack keeps a final snapshot. The migrations need `citext`, `pgcrypto` and `uuid-ossp`, which Aurora provides;
  nothing uses PostGIS.
- Rejected: reusing the legacy `atlas-index-testing-cluster` database. It would share data with the legacy service
  and sit outside CI/CD.

**AD-11 Auth: Cognito clients in the base stack, like species-lists (DG-4).**
- A login client for search-service (authorization code with PKCE, no secret). Callbacks are
  `https://service-cicd.<zone>/callback?client_name=OidcClient`, the service root and every UI; logout URLs are
  every UI's base URL, which is what the UIs send on logout.
- A machine-to-machine client (client credentials, with a secret) for search-service's calls to other ALA services
  (`webservice.client-id`).
- The deploy reads both IDs from the base stack, and the secret from Cognito, so nothing is copied by hand.

## Decision gates

Decided:

| Gate | Decision |
|---|---|
| DG-1 | The species-lists testing AWS account. |
| DG-2 | The `test.ala.org.au` zone is in that account; the species-lists testing certificates are used. |
| DG-3 | Every app keeps its legacy name with `-cicd` appended (`doi-cicd`, `biocache-cicd`, `sds-cicd`, …). |
| DG-4 | Cognito for testing, with clients like species-lists' in the base stack (AD-11). |
| DG-5 | The shared regolith Elasticsearch and RabbitMQ, and a new `database` component with Aurora PostgreSQL (AD-10). |
| DG-7 | The account's CodeBuild concurrency quota covers a `common-ui` change (up to 16 MEDIUM builds, then 8 LARGE). |
| DG-8 | All three browsers on every run; the cost is accepted. |
| Maps key | The Google Maps browser key is public by design and committed in `frontend/config.ini`; Google restricts it by referrer. |

Open:

| Gate | Needed before | Question |
|---|---|---|
| DG-6 | frontend | The `VITE_*` values were seeded from each `.env.playwright`, with local hosts mapped to the environment and other ALA service URLs kept unchanged. Check them against the legacy deployment. |
| DG-9 | staging/production | Add `[staging]`/`[production]` sections to each `cicd/frontend/<ui>/config.ini` (UI values from the production `.env.production` files; without them a UI falls back to `[DEFAULT]`, which holds test values), the production RabbitMQ (`TODO-DG9` in [backend/config.ini](backend/config.ini)), the prod OIDC/CAS settings, the decommission owners, and the static content migration. |

## Verify on the first AWS run

These parts are validated locally (cfn-lint, shellcheck, Helm lint/template, the image build, and the gate scripts
run against real suites with S3 stubbed) but can't be proven without AWS:

- Bootstrap role permissions (see [First-time setup](#first-time-setup)).
- The ECR pull policy for CodeBuild (`ImagePullCredentialsType: CODEBUILD`).
- Firefox inside the Playwright image. It can't launch from a non-interactive macOS shell, so it is untested locally.
- The shared-service names taken from the legacy notes and species-lists: the RabbitMQ service `testing.rabbitmq.svc`
  and pod `testing-server-0`, the `username`/`password` keys in `ala-regolith-testing-rabbitmq`, and the CA secret
  `testing-cluster-es-http-certs-public`. The deploy fails with the missing name if any is wrong.
- search-service connecting to the shared Elasticsearch over TLS with the imported CA. The truststore step itself
  was checked in the runtime image.
- The pods reaching Aurora on 5432 (its security group allows the VPC CIDR, as species-lists' database does).
