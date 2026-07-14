# HookTrials

Open-source integration reliability control plane. HookTrials tests failure behavior, safely
operates webhook delivery and monitors APIs, HTTP routes and destinations from one dashboard.

> Your webhook works when everything goes right. HookTrials tests everything else.

Current public release: **v0.3.6** (14 July 2026). The managed sandbox is available at
[app.hooktrials.com](https://app.hooktrials.com); use synthetic payloads whenever possible.

## Run locally

Requirements: Docker Engine, Docker Compose v2 and OpenSSL.

```bash
git clone https://github.com/IKER-36/hooktrials.git
cd hooktrials
./hooktrials up
```

Open `http://localhost:3000`. First account becomes installation administrator; public registration
then closes. Self-hosted mode has no endpoint or daily-event quota by default.

```bash
./hooktrials status
./hooktrials logs
./hooktrials backup
./hooktrials update
```

To receive webhooks from external providers, configure your existing HTTPS proxy or let the
included Caddy profile manage a public domain:

```bash
./hooktrials configure proxy https://trials.example.com 3000
# or: ./hooktrials configure domain trials.example.com operator@example.com
./hooktrials up
./hooktrials doctor --external
```

See [External access](docs/external-access.md) for DNS, Cloudflare, firewall and tunnel guidance.

Runtime secrets are generated once inside ignored `.hooktrials/runtime.env` with restrictive file
permissions. Never delete or rotate `PAYLOAD_ENCRYPTION_KEY` while encrypted payloads exist.

## Included

- React dashboard, login and first-run setup. No marketing landing.
- First-entry product tour with a permanent restart control.
- Unified Control Center, integration inventory and Operations recovery queue.
- One-click Demo Lab filling every product module with an isolated, realistic synthetic workspace.
- Fastify API and isolated public ingestion service.
- Background analysis and retention worker.
- PostgreSQL migrations and Redis/BullMQ processing.
- Deterministic `500`, `503`, `429` and recovery scenarios.
- Scenario Studio for custom multi-step status, delay, header and body recipes.
- Guided endpoint templates and an integrated provider simulator.
- Live event stream, retry timeline and encrypted payload inspector.
- Trial, Observe and Protect route modes with contracts and GitHub/Stripe signatures.
- Durable retries, dead-letter recovery, incidents, outgoing alerts and redacted evidence links.
- Active API/HTTP monitoring with explainable availability, latency and integrity scores.
- Single-origin self-hosting through Docker Compose.
- Terminal CLI and reusable GitHub Action for deterministic reliability trials in CI.

## One-click full product demo

After signing in, open **Demo Lab** and select **Run full demo**. HookTrials creates and exercises a
complete synthetic workspace instead of showing static sample cards:

- a custom cascading-outage scenario and a `500 → 503 → 429 → 200` Trial timeline;
- Observe and Protect traffic with destination evidence, durable retries and recovery;
- four active monitors covering an external API, internal API, HTTP route and webhook destination;
- healthy, degraded, down and recovered monitor states with latency and availability history;
- an exhausted protected delivery in the dead-letter inbox, ready for replay or discard;
- open and recovered incidents, protected deliveries and safe synthetic alert-audit entries;
- one redacted evidence report with an expiring share link.

Every generated resource belongs to the signed-in account and receives a private run identifier.
**Clean only this demo run** removes that exact workspace without matching names or touching other
user data. Demo incidents never call a real alert webhook configured by the user.

See [Full Demo Lab](docs/demo-lab.md) for the generated dataset, safety boundary and cleanup model.

## Repository model

This public repository contains the complete self-hosted product. Managed hosting operations and
the marketing website are outside its scope and are not required to run HookTrials locally.

## Documentation

- [Getting started](docs/getting-started.md)
- [Trial, Observe and Protect](docs/trial-mode.md)
- [Monitoring](docs/monitoring.md)
- [Contracts and signatures](docs/contracts-and-signatures.md)
- [Incidents, alerts and evidence](docs/incidents-alerts-evidence.md)
- [Architecture](docs/architecture.md)
- [Guided demonstration](docs/guided-demo.md)
- [Full Demo Lab](docs/demo-lab.md)
- [CLI and GitHub Actions](docs/cli-and-ci.md)
- [Competition demonstration script](docs/competition-demo.md)
- [Scenario Studio](docs/scenario-studio.md)
- [Self-hosting](docs/self-hosting.md)
- [Configuration](docs/configuration.md)
- [Development](docs/development.md)
- [Security](docs/security.md)
- [Current release status](docs/release-status.md)

## Source development

```bash
corepack enable
pnpm install
pnpm check
pnpm dev
```

## License

HookTrials is licensed under the [GNU Affero General Public License v3.0](LICENSE), using the
`AGPL-3.0-only` SPDX identifier. Modified versions made available over a network must offer their
corresponding source code to users.
