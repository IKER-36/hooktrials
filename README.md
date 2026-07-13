# HookTrials

Open-source webhook resilience and contract-testing lab. HookTrials captures deliveries, runs
deterministic failure scenarios, correlates retries and shows evidence about recovery behavior.

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

Runtime secrets are generated once inside ignored `.hooktrials/runtime.env` with restrictive file
permissions. Never delete or rotate `PAYLOAD_ENCRYPTION_KEY` while encrypted payloads exist.

## Included

- React dashboard, login and first-run setup. No marketing landing.
- Fastify API and isolated public ingestion service.
- Background analysis and retention worker.
- PostgreSQL migrations and Redis/BullMQ processing.
- Deterministic `500`, `503`, `429` and recovery scenarios.
- Live event stream, retry timeline and encrypted payload inspector.
- Single-origin self-hosting through Docker Compose.

## Repository model

This public repository is complete self-hosted product. Hosted service uses same core images. Private
landing and CubePath production orchestration live in separate repositories; neither is required to
run HookTrials locally.

## Documentation

- [Architecture](docs/architecture.md)
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
