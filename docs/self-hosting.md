# Self-hosting

## Requirements

- Docker Engine with Compose v2.
- OpenSSL.
- Approximately 2 CPU, 4 GB RAM and 20 GB free disk for source builds.

## Install

```bash
git clone https://github.com/IKER-36/hooktrials.git
cd hooktrials
./hooktrials doctor
./hooktrials up
```

Visit `http://localhost:3000` and create owner account. Fresh volumes contain no users, endpoints or
events. Built-in deterministic scenarios are seeded automatically.

## Public domain and HTTPS

Recommended: place HookTrials behind existing HTTPS reverse proxy and start with:

```bash
HOOKTRIALS_BIND=127.0.0.1 \
HOOKTRIALS_PORT=3000 \
HOOKTRIALS_ORIGIN=https://trials.example.com \
COOKIE_SECURE=true \
./hooktrials up
```

Proxy all paths, including `/api/*` and `/i/*`, to `127.0.0.1:3000`. Preserve streaming and disable
response buffering for `/api/v1/endpoints/*/stream`.

## Operations

```bash
./hooktrials status
./hooktrials logs api
./hooktrials backup
./hooktrials update
./hooktrials down
```

`./hooktrials reset --yes` permanently deletes database, Redis data and generated runtime secrets.

## Backups

`./hooktrials backup` creates a mode-`0600` compressed PostgreSQL dump under `backups/`. Copy it and
encrypted runtime configuration off-host. Redis is operational state, not database backup.
