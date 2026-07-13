# Deployment profiles

Public repository supports self-hosted deployment. Run `./hooktrials configure` to choose local,
existing-proxy or direct-domain mode, then `./hooktrials up`. It builds images, runs migrations and
exposes one configured origin.

Managed HookTrials Cloud is deployed separately using immutable application images. Managed
hosting details and production secrets are not part of this repository.

Tagged releases will publish:

```text
ghcr.io/<owner>/<repo>-web:<version>
ghcr.io/<owner>/<repo>-server:<version>
```

Self-hosted Compose can move from source builds to these images after first public release without
changing persisted volumes.
