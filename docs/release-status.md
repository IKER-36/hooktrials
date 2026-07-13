# Current release status

Updated: 14 July 2026.

## Release `v0.3.4`

The current public release includes the complete Integration Reliability Control Plane:

- deterministic Trial scenarios and guided retry demonstrations;
- Observe forwarding and Protect durable delivery;
- active HTTP monitoring, incidents and explainable scores;
- contracts, GitHub/Stripe signatures, dead letters, alerts and redacted evidence links;
- unified Control Center, Monitor inventory, Operations queue and persisted seven-step onboarding;
- one-command self-hosting with local, existing-proxy and direct-domain modes;
- a full Demo Lab for Trial, Observe, Protect, Monitor and Operations evidence;
- a terminal CLI and bundled GitHub Action for exact response-sequence checks in CI.

The quality gate passes formatting, ESLint, strict TypeScript, 111 automated tests and all
production builds. A clean self-hosted E2E passed outgoing alert delivery, monitor incident and
recovery, Protect dead-letter and manual recovery, and Operations reconciliation.

The Demo Lab then passed direct API and browser execution: Trial `500 -> 500 -> 200`, Observe
destination failure, Protect `202` plus three-attempt durable recovery, three immediate Monitor
checks, recovered incident, Operations summary and cleanup of exactly the three run-owned resources.
The CLI and bundled Action independently passed the same `500 -> 500 -> 200` scenario and emitted
JSON plus JUnit evidence.

## Self-host worker correction

The source `compose.yml` attaches `worker` only to the internal `data` network. This prevents active
monitors, Protect deliveries and outgoing alert webhooks from reaching external destinations even
though application-level SSRF controls are working. Trial and Observe remain functional.

The correction is included in `v0.3.4`. Self-hosted `v0.3.3` operators can either update or add the
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
this dual-network topology. Release `v0.3.4` is not described as live there until its backup-first
promotion and authenticated post-deploy journey pass.

## Cloud availability

- Landing: <https://hooktrials.com>
- Dashboard: <https://app.hooktrials.com>
- API health: <https://api.hooktrials.com/healthz>
- Ingestion health: <https://hooks.hooktrials.com/healthz>

The hosted sandbox uses quotas and 72-hour payload retention. It is a testing service, not a vault;
prefer synthetic data.
