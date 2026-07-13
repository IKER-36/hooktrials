# Development

## Complete local stack

To run the production-shaped application locally with browser-accessible ports:

```bash
pnpm dev:stack
```

Open `http://localhost:8080`. The local API listens only on `127.0.0.1:3001` and the local webhook
ingestor on `127.0.0.1:3002`. The helper uses clearly labelled local-only credentials and does not
create an environment file.

Stop the stack without deleting its local database:

```bash
pnpm dev:stack:down
```

Delete all synthetic local data and recreate it on the next start:

```bash
pnpm dev:stack:reset
```

## Install

```bash
corepack enable
pnpm install
```

The application validates all runtime variables at startup. Inject local development values from
your terminal or an external secret manager. Never create an environment file inside the
repository.

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

## Database

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

Schema changes must include generated migrations. Do not edit a migration that has already been
used outside the developer machine.

## Code boundaries

- Web code must not import server packages.
- Ingestor code must not implement account or administrative features.
- Workers must be idempotent because queue jobs can be delivered more than once.
- Shared request and response structures belong in packages/contracts.
- Scenario behavior belongs in packages/scenario-engine and requires unit tests.
- Logging must use the shared redacting logger.

## Private context

Internal planning belongs in .pdocs. That directory is intentionally absent from Git history and
must never contain the only copy of production credentials.
