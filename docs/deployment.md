# Deployment profiles

Public repository supports self-hosted deployment. Run `./hooktrials configure` to choose local,
existing-proxy or direct-domain mode, then `./hooktrials up`. It builds images, runs migrations and
exposes one configured origin.

Managed HookTrials Cloud is deployed separately using immutable application images. Managed
hosting details and production secrets are not part of this repository.

Tagged releases publish versioned multi-architecture images:

```text
ghcr.io/<owner>/<repo>-web:<version>
ghcr.io/<owner>/<repo>-server:<version>
```

The current tagged release is `v0.12.4`. Self-hosted Compose intentionally builds the checked-out
source so local modifications remain auditable. Managed deployments pin immutable registry or
preloaded images without changing persisted database/Redis volumes.

Before promoting a release, read [Release status](release-status.md), back up PostgreSQL and the
runtime encryption key, validate Compose configuration and run an authenticated smoke test.

For self-hosted installations, updates are currently manual and checkout-based: fetch/select a
tag, run `./hooktrials backup`, then `./hooktrials update` and `./hooktrials doctor`. The updater
does not pull Git changes or back up data for you; named PostgreSQL/Redis volumes and the ignored
runtime configuration remain intact unless `./hooktrials reset --yes` is run.
