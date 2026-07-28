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

The current tagged release is `v0.14.0`. Self-hosted Compose intentionally builds the checked-out
source so local modifications remain auditable. Managed deployments pin immutable registry or
preloaded images without changing persisted database/Redis volumes.

Before promoting a release, read [Release status](release-status.md), back up PostgreSQL and the
runtime encryption key, validate Compose configuration and run an authenticated smoke test.

For self-hosted installations, `./hooktrials update --release vX.Y.Z` performs a backup, release
switch, source build, migration wait and Compose health check. It requires a clean checkout and
does not pull Git changes automatically. On failure it restores the previous source checkout;
database migrations require the printed backup for recovery. Named PostgreSQL/Redis volumes and the
ignored runtime configuration remain intact unless `./hooktrials reset --yes` is run.
