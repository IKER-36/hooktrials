# Architecture

## Product boundary

This repository contains complete HookTrials product: dashboard, authentication, API, ingestion,
worker, database and queue. Marketing site is deliberately separate and is never built or deployed
by self-hosted installations.

## Services

| Service  | Responsibility                            | Public exposure           |
| -------- | ----------------------------------------- | ------------------------- |
| gateway  | One HTTP origin and path routing          | host port 3000 by default |
| web      | Static React dashboard                    | internal                  |
| api      | Auth, routes, monitors, incidents and SSE | `/api/*` through gateway  |
| ingestor | Intake, validation and Observe forwarding | `/i/*` through gateway    |
| worker   | Monitor checks, Protect delivery, alerts  | none                      |
| postgres | Source of truth                           | none                      |
| redis    | Queue and live-event channel              | none                      |
| migrate  | One-shot schema migration                 | none                      |

```text
browser ── / ───────> dashboard
        └─ /api/* ──> API ─────────────┐
provider ─ /i/* ────> ingestor ────────┼─> PostgreSQL
                         │              └─> Redis/BullMQ ─> worker
                         └─ Observe ──────────────────────> destination
                                        Protect worker ──> destination
                                        Monitor worker ──> HTTP or ICMP resource
```

PostgreSQL and Redis use internal Docker network. API and ingestor remain separate trust boundaries.
Payloads are encrypted before persistence. Endpoint/session tokens are stored as hashes.

The worker uses both the internal data network and an egress-capable application network to run
public monitors, protected deliveries and outgoing alerts. The data network remains internal and
PostgreSQL/Redis publish no host ports.

## Product data paths

- **Trial:** ingestor returns deterministic scenario responses; no destination call.
- **Observe:** ingestor validates, forwards once and mirrors the destination response.
- **Protect:** ingestor validates and persists before returning `202`; the worker owns retries,
  dead-letter and recovery.
- **Monitor:** the worker runs bounded HTTP/HTTPS or ICMP checks; it never proxies normal API
  traffic. The worker alone receives the `NET_RAW` capability required by ICMP.

Inbound provider attempts and outbound destination deliveries are separate records. This prevents a
backend `503` from being mistaken for failure to receive the provider request.

Shared packages enforce outbound network policy, delivery backoff, monitor state and deterministic
signature/contract scoring. PostgreSQL is the durable source of truth; BullMQ coordinates bounded
work and per-destination concurrency.

## Deployment modes

`DEPLOYMENT_MODE=selfhost` defaults to first-user registration and unlimited commercial quotas.
`DEPLOYMENT_MODE=cloud` uses open registration and operator-configured quotas. Same backend and
dashboard code serve both modes; only runtime policy and edge topology differ.

## First-run safety

`REGISTRATION_MODE=first-user` allows registration only while user table is empty. Registration uses
a PostgreSQL advisory transaction lock, preventing two concurrent requests from both becoming first
administrator.
