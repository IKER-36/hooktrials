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
```

Read [External access](external-access.md) for DNS, Cloudflare, firewall, tunnel and troubleshooting
instructions.

Before enabling Monitor, Protect or outgoing alerts on release `v0.3.3`, read the self-host worker
egress note in [Release status](release-status.md). Trial and Observe are unaffected by that Compose
networking limitation.

## First useful trial

1. Open **Endpoints** and choose a starter template.
2. Copy the generated ingestion URL.
3. Use the integrated simulator with synthetic data, or configure that URL in your webhook sender.
4. Watch attempts arrive in **Overview** and inspect the retry timeline.
5. Open **Scenario Studio** to create the exact failure/recovery sequence needed by your system.

## Operations

```bash
./hooktrials status
./hooktrials logs api
./hooktrials backup
./hooktrials update
./hooktrials down
```

`./hooktrials reset --yes` permanently deletes PostgreSQL, Redis data and generated runtime secrets.

## Backups

`./hooktrials backup` creates a mode-`0600` compressed PostgreSQL dump under `backups/`. Copy it and
the encrypted runtime configuration off-host. Redis is operational state, not a database backup.
