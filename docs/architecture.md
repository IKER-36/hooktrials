# Architecture

## Product boundary

This repository contains complete HookTrials product: dashboard, authentication, API, ingestion,
worker, database and queue. Marketing site is deliberately separate and is never built or deployed
by self-hosted installations.

## Services

| Service  | Responsibility                             | Public exposure           |
| -------- | ------------------------------------------ | ------------------------- |
| gateway  | One HTTP origin and path routing           | host port 3000 by default |
| web      | Static React dashboard                     | internal                  |
| api      | Auth, endpoints, scenarios, events and SSE | `/api/*` through gateway  |
| ingestor | Untrusted webhook intake                   | `/i/*` through gateway    |
| worker   | Analysis and retention                     | none                      |
| postgres | Source of truth                            | none                      |
| redis    | Queue and live-event channel               | none                      |
| migrate  | One-shot schema migration                  | none                      |

```text
browser ── / ───────> dashboard
        └─ /api/* ──> API ─────┐
provider ─ /i/* ────> ingestor ├─> PostgreSQL
                               └─> Redis/BullMQ ─> worker
```

PostgreSQL and Redis use internal Docker network. API and ingestor remain separate trust boundaries.
Payloads are encrypted before persistence. Endpoint/session tokens are stored as hashes.

## Deployment modes

`DEPLOYMENT_MODE=selfhost` defaults to first-user registration and unlimited commercial quotas.
`DEPLOYMENT_MODE=cloud` uses open registration and operator-configured quotas. Same backend and
dashboard code serve both modes; only runtime policy and edge topology differ.

## First-run safety

`REGISTRATION_MODE=first-user` allows registration only while user table is empty. Registration uses
a PostgreSQL advisory transaction lock, preventing two concurrent requests from both becoming first
administrator.
