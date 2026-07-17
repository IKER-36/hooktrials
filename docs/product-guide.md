# Product guide

The dashboard includes a searchable **Docs** module at `/app/docs`. This guide is the public,
self-hosted companion for operators who want the same workflow outside the application.

## Overview and Production Readiness

Use **Overview** as the operational starting point. Select an endpoint, read the Control Center for
cross-product health, then follow the highest-impact missing item in Production Readiness. The score
is derived only from configuration and stored evidence: public HTTPS reachability, inbound contract,
signature verification, destination configuration, durable delivery, observed traffic, recovery,
evidence generation and incident state.

## Endpoints and route modes

For real integrations, start in **Live Webhooks**. Webhook Hub creates the provider-facing URL,
encrypted destination, validation and delivery strategy atomically, then explains exactly where to
paste the URL. The route appears beside every other provider connection in the concentrator view.

Use **Endpoints** and **Scenario Studio** for deterministic Trial work. A Trial route can still be
promoted manually after its destination and production controls are ready.

1. Create an endpoint from a starter or choose a scenario explicitly.
2. Copy its stable ingestion URL.
3. Send a synthetic request and inspect its retry timeline.
4. Add a destination before changing to **Observe** or **Protect**.
5. Confirm explicitly when changing a production route.

**Trial** returns deterministic responses without contacting a destination. **Observe** forwards once
and records both sides. **Protect** persists the event first, retries with bounded backoff and moves
exhausted deliveries to the dead-letter inbox. Destination URLs, headers, contracts and signing
secrets are encrypted and write-only.

## Scenario Studio

Built-in scenarios cover basic inspection, rate limiting, temporary outage and unstable services.
Custom scenarios define an ordered sequence of status, delay, headers and response body. Use the
same HookTrials event ID across sender retries so every attempt stays in one timeline.

## Monitor

Create an HTTP monitor with method, expected status range, timeout, cadence and failure threshold,
or an ICMP monitor for host reachability. Optional HTTP contracts can require headers or JSON paths.
Run or edit it, inspect latency and availability, then combine selected monitors in a customizable
status page when the redacted public fields are suitable. Monitor pause affects active checks only;
it never pauses webhook routes.

## Operations

Operations combines open and recovered incidents, unresolved dead letters and alert-delivery audit.
Retry continues an existing protected delivery. Replay creates a new delivery from the preserved
event. Both require explicit confirmation and record operator/source metadata. Check destination
health and idempotency before either action.

## Demo Lab

Demo Lab creates isolated, user-owned synthetic resources that exercise Trial, Observe, Protect,
Monitor, Operations and Evidence through the normal API, queue and worker paths. It is a learning and
competition-demonstration workspace, not a substitute for real endpoints and monitors. Reset removes
only resources owned by Demo Lab.

## Security and data handling

- Use synthetic payloads for testing and avoid unnecessary personal or production data.
- Public status and evidence links are opaque, redacted and revocable.
- Outbound destinations are checked by the shared network policy; private CIDRs require an explicit
  allowlist.
- A local-only self-hosted URL cannot receive cloud-provider traffic. Configure a public HTTPS domain
  or an existing reverse proxy first.

## Troubleshooting order

1. Confirm the route or monitor is active.
2. Confirm the public HTTPS URL is reachable from outside the host.
3. Read contract and signature evidence before changing validation rules.
4. Inspect individual attempts, `Retry-After` and destination outcomes.
5. Open Operations for incident or dead-letter recovery.

Continue with [Getting started](getting-started.md), [Monitoring](monitoring.md),
[Webhook Hub](live-webhook-hub.md), [Protect mode](protect-mode.md) and
[External access](external-access.md).
