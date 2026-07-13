# Deployment profiles

Public repository supports self-hosted profile only. Run `./hooktrials up`; it builds local images,
runs migrations and exposes one origin.

Managed HookTrials Cloud is deployed separately using immutable
dashboard, server and landing images. Production secrets, CubePath topology and landing source are
not part of this repository.

Tagged releases will publish:

```text
ghcr.io/<owner>/<repo>-web:<version>
ghcr.io/<owner>/<repo>-server:<version>
```

Self-hosted Compose can move from source builds to these images after first public release without
changing persisted volumes.
