# HookTrials

Open-source integration reliability control plane. HookTrials tests failure behavior, safely
operates webhook delivery and monitors APIs, HTTP routes and destinations from one dashboard.

> Your webhook works when everything goes right. HookTrials tests everything else.

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
- [Scenario Studio](docs/scenario-studio.md)
- [Self-hosting](docs/self-hosting.md)
- [Configuration](docs/configuration.md)
- [Development](docs/development.md)
- [Security](docs/security.md)

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
