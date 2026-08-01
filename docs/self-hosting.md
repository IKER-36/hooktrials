# Self-hosting

## Requirements

- Docker Engine with Compose v2.
- OpenSSL.
- Approximately 2 CPU, 4 GB RAM and 20 GB free disk for source builds.

## Install locally

```bash
git clone https://github.com/IKER-36/hooktrials.git
cd hooktrials
./hooktrials doctor
./hooktrials up
```

Visit `http://localhost:3000`. The first account becomes installation owner and registration then
closes. Fresh volumes contain no users, endpoints or events. Built-in scenarios are seeded
automatically.

## Receive external webhooks

Local URLs cannot be reached by cloud providers. Choose one supported mode:

```bash
# Existing HTTPS reverse proxy
./hooktrials configure proxy https://trials.example.com 3000

# Dedicated VPS; automatic HTTPS on ports 80/443
./hooktrials configure domain trials.example.com operator@example.com

./hooktrials up
./hooktrials doctor --external

# Full local diagnostics: Compose services, API metadata, disk and backup checks
./hooktrials doctor --deep
```

Read [External access](external-access.md) for DNS, Cloudflare, firewall, tunnel and troubleshooting
instructions.

The current release gives the worker outbound access for Monitoring, Protect and outgoing alerts while
keeping PostgreSQL and Redis on the internal data network.

For public deployments, keep `TRUST_PROXY_HOPS=1` when one reverse proxy sits in front of HookTrials.
If the service is exposed directly, set it to `0` and apply a firewall or tunnel in front of the
application. Never expose PostgreSQL or Redis ports.

## First useful trial

1. Open **Trial endpoints** in the Lab workspace and choose a starter template.
2. Copy the generated ingestion URL.
3. Use the integrated simulator with synthetic data, or configure that URL in your webhook sender.
4. Watch attempts arrive in **Control Center** and inspect the retry timeline.
5. Open **Failure scenarios** to create the exact failure/recovery sequence needed by your system.

## Operations

```bash
./hooktrials status
./hooktrials logs api
./hooktrials backup
./hooktrials update
./hooktrials down
```

### Updating without losing data

`./hooktrials update` now performs a backup, rebuilds the checked-out release, runs migrations,
waits for Compose health checks and prints a rollback backup reference. It never runs `git pull` or
modifies `.hooktrials/runtime.env` for you. Use `--release` to select a tagged release; the working
tree must be clean. Each update also snapshots the encrypted runtime file in `backups/` and stores a
small mode-`0600` update state under `.hooktrials/`, so the previous checkout can be restored with a
single command.

Preview a tagged update without changing containers, volumes or application data:

```bash
git fetch --tags origin
./hooktrials update --release v0.33.12 --check
```

Update to a tagged release:

```bash
git status --short                 # keep local changes out of production
git fetch --tags origin
./hooktrials update --release v0.33.12
./hooktrials doctor --external     # omit --external for local-only mode
```

If the new checkout is not suitable, restore the previous code and restart the stack with:

```bash
./hooktrials rollback --yes
```

Rollback keeps PostgreSQL and Redis data untouched. It restores application code only; the printed
database backup is the recovery boundary if a migration needs to be reversed manually. `./hooktrials
status` shows the active release and the last update state. Keep both the database backup and the
runtime snapshot off-host and encrypted.

To rebuild the current checkout without changing Git refs:

```bash
./hooktrials update
```

If build, migration or health checks fail after a release switch, the CLI restores the previous
source checkout and restarts it. Database migrations are not automatically reversed: use the
printed mode-`0600` backup and the documented restore procedure if schema recovery is required.

PostgreSQL and Redis live in named Docker volumes, while `.hooktrials/runtime.env` is ignored and
preserved. Updating the checkout or rebuilding containers therefore keeps users, endpoints,
events and encryption keys. Never run `./hooktrials reset --yes` as part of an update: it deletes
the volumes and runtime secrets. Keep the backup and encrypted runtime configuration off-host so a
failed migration or host loss has a recovery path.

`./hooktrials reset --yes` permanently deletes PostgreSQL, Redis data and generated runtime secrets.

## Backups

`./hooktrials backup` creates a mode-`0600` compressed PostgreSQL dump under `backups/`. Copy it and
the encrypted runtime configuration off-host. Redis is operational state, not a database backup.
