# Current release status

Updated: 15 July 2026.

## Release `v0.5.0`

Release `v0.5.0` turns existing reliability evidence into an operator-facing decision layer:

- Reliability Replay with deterministic diagnosis, impact, causal stages and runbook;
- first-to-selected attempt comparison for HTTP response, latency, integrity and payload stability;
- explainable 100-point Production Readiness with a highest-impact next action;
- Stripe, GitHub, Shopify and Slack route-configuration starters;
- revocable public monitor status pages with 24-hour health and incident history;
- reload-safe Demo Lab recovery, all-run reset and quota-reserved temporary endpoints.

The release gate passes formatting, ESLint, strict TypeScript, 115 automated tests, production
builds, migration `0008`, a production-shaped Docker rebuild and a browser-driven eight-step Demo
Lab. Browser validation also covered recovered-run reset, reload recovery, Readiness, Reliability
Replay and zero console errors. Immutable multi-architecture images were published and the
backup-first CubePath promotion passed on 15 July 2026.

## Previous release `v0.4.0`

Release `v0.4.0` makes the complete product easier to understand and demonstrate:

- a modern, accessible dashboard with a calmer glass-and-rounded visual system;
- an eight-step Demo Lab covering Scenario Studio, Trial, Observe, Protect, Monitor, the recovery
  queue, Operations and redacted Evidence;
- four active monitor types with healthy, degraded, down and recovered histories;
- a real protected delivery that exhausts three attempts and enters the dead-letter inbox;
- isolated cleanup by authenticated user and private `demoRunId`.

The release gate passes formatting, ESLint, strict TypeScript, 112 automated tests, all production
builds and the complete browser-driven Demo Lab. The verified run produced a recoverable delivery,
an unresolved dead letter, open and recovered incidents, synthetic alert audit records and an
expiring evidence report without browser-console errors.

## Previous release `v0.3.6`

The current public release includes the complete Integration Reliability Control Plane:

- deterministic Trial scenarios and guided retry demonstrations;
- Observe forwarding and Protect durable delivery;
- active HTTP monitoring, incidents and explainable scores;
- contracts, GitHub/Stripe signatures, dead letters, alerts and redacted evidence links;
- unified Control Center, Monitor inventory, Operations queue and persisted seven-step onboarding;
- one-command self-hosting with local, existing-proxy and direct-domain modes;
- a full Demo Lab for Trial, Observe, Protect, Monitor and Operations evidence;
- a terminal CLI and bundled GitHub Action for exact response-sequence checks in CI.

The quality gate passes formatting, ESLint, strict TypeScript, 112 automated tests and all
production builds. A clean self-hosted E2E passed outgoing alert delivery, monitor incident and
recovery, Protect dead-letter and manual recovery, and Operations reconciliation.

The Demo Lab then passed direct API and browser execution: Trial `500 -> 500 -> 200`, Observe
destination failure, Protect `202` plus three-attempt durable recovery, three immediate Monitor
checks, recovered incident, Operations summary and cleanup of exactly the three run-owned resources.
The CLI and bundled Action independently passed the same `500 -> 500 -> 200` scenario and emitted
JSON plus JUnit evidence.

## Self-host worker correction

Public release `v0.3.3` attached `worker` only to the internal `data` network. That prevented active
monitors, Protect deliveries and outgoing alert webhooks from reaching external destinations even
though application-level SSRF controls were working. Trial and Observe remained functional.

The correction is included in `v0.3.6`. Self-hosted `v0.3.3` operators can either update or add the
egress-capable `edge` network to the worker service:

```yaml
services:
  worker:
    networks: [edge, data]
```

Then apply the change with:

```bash
./hooktrials up
```

Keep `data` internal and never publish PostgreSQL or Redis ports. The Cloud deployment already uses
this dual-network topology. Release `v0.3.6` was promoted to the managed sandbox through a
backup-first deployment and passed its authenticated post-deploy journey on 14 July 2026.

## Cloud availability

- Landing: <https://hooktrials.com>
- Dashboard: <https://app.hooktrials.com>
- API health: <https://api.hooktrials.com/healthz>
- Ingestion health: <https://hooks.hooktrials.com/healthz>

The hosted sandbox uses quotas and 72-hour payload retention. It is a testing service, not a vault;
prefer synthetic data.

Managed Cloud runs server and dashboard `v0.5.0` with landing `v0.4.0`. Public HTTPS smoke,
migration `0008`, authenticated Production Readiness, Reliability Replay, persistent Demo Lab and a
revocable public monitor status page passed after deployment. The retained jury workspace contains
synthetic data only.

Patch `v0.3.6` also accepts authenticated empty payload ciphertext during report analysis. Empty
webhook bodies now produce normal deterministic evidence instead of a failed background job.
