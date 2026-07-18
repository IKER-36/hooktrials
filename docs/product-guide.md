# Product guide

The dashboard includes a searchable **Docs** module at `/app/docs`. This guide is the public,
self-hosted companion for operators who want the same workflow outside the application.

## Workspace map

The dashboard deliberately separates live work from experiments:

- **Product** contains Control Center, Webhook Hub, Monitoring and Operations. These modules work
  with real integrations, health signals, incidents and recovery.
- **Lab** contains Trial endpoints, Failure scenarios and Guided Demo. These modules use synthetic
  traffic and deterministic failures without being presented as live connections.
- **Resources** contains the searchable operator documentation.

The slim context line above every page always identifies the current workspace and module. The same
structure is retained when the desktop rail is collapsed and in the horizontally scrollable mobile
navigation.

## Control Center and Production Readiness

Use **Control Center** as the operational starting point. Select a route, read cross-product health,
then follow the highest-impact missing item in Production Readiness. The score
is derived only from configuration and stored evidence: public HTTPS reachability, inbound contract,
signature verification, destination configuration, durable delivery, observed traffic, recovery,
evidence generation and incident state.

## Live connections and Trial endpoints

For real integrations, start in **Webhook Hub**. It creates the provider-facing URL,
encrypted destination, validation and delivery strategy atomically, then explains exactly where to
paste the URL. The route appears beside every other provider connection in the concentrator view.

Use **Trial endpoints** and **Failure scenarios** only for deterministic Lab work. They are listed
separately from real Observe/Protect connections so synthetic experiments cannot be mistaken for
production delivery paths.

1. Create an endpoint from a starter or choose a scenario explicitly.
2. Copy its stable ingestion URL.
3. Send a synthetic request and inspect its retry timeline.
4. Inspect the correlated attempts and prove the sender's retry behaviour.
5. Create a separate live connection in Webhook Hub when moving to real traffic.

**Trial** returns deterministic responses without contacting a destination. **Observe** forwards once
and records both sides. **Protect** persists the event first, retries with bounded backoff and moves
exhausted deliveries to the dead-letter inbox. Destination URLs, headers, contracts and signing
secrets are encrypted and write-only.

## Failure scenarios

Built-in scenarios cover basic inspection, rate limiting, temporary outage and unstable services.
Custom scenarios define an ordered sequence of status, delay, headers and response body. Use the
same HookTrials event ID across sender retries so every attempt stays in one timeline.

## Monitoring

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

## Guided Demo

Guided Demo creates isolated, user-owned synthetic resources that exercise Trial, Observe, Protect,
Monitoring, Operations and Evidence through the normal API, queue and worker paths. It is a learning and
competition-demonstration workspace, not a substitute for real endpoints and monitors. Reset removes
only resources owned by the current demo run.

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
