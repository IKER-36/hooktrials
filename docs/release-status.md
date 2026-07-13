# Current release status

Updated: 13 July 2026.

## Release `v0.3.3`

The current public release includes the complete Integration Reliability Control Plane:

- deterministic Trial scenarios and guided retry demonstrations;
- Observe forwarding and Protect durable delivery;
- active HTTP monitoring, incidents and explainable scores;
- contracts, GitHub/Stripe signatures, dead letters, alerts and redacted evidence links;
- unified Control Center, Monitor inventory, Operations queue and persisted seven-step onboarding;
- one-command self-hosting with local, existing-proxy and direct-domain modes.

The quality gate passes formatting, ESLint, strict TypeScript, 109 automated tests and all
production builds. The managed Cloud flow has also passed registration, onboarding, endpoint CRUD,
`500 -> 500 -> 200` recovery, event inspection, monitor incident/recovery, Operations and relogin in
a real browser.

## Known self-host limitation in `v0.3.3`

The source `compose.yml` attaches `worker` only to the internal `data` network. This prevents active
monitors, Protect deliveries and outgoing alert webhooks from reaching external destinations even
though application-level SSRF controls are working. Trial and Observe remain functional.

Until the next patch release, self-hosted operators can add the egress-capable `edge` network to the
worker service:

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
this dual-network topology and passed an external monitor recovery test.

## Cloud availability

- Landing: <https://hooktrials.com>
- Dashboard: <https://app.hooktrials.com>
- API health: <https://api.hooktrials.com/healthz>
- Ingestion health: <https://hooks.hooktrials.com/healthz>

The hosted sandbox uses quotas and 72-hour payload retention. It is a testing service, not a vault;
prefer synthetic data.
