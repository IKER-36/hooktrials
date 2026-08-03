# Product guide

HookTrials is organized around the job an operator wants to complete. The authenticated dashboard
also includes a searchable **Documentation** module at `/app/docs`; this guide is its public,
self-hosted companion.

## Start with one outcome

Home presents three primary starting points:

1. **Connect a real webhook** opens Integrations for provider traffic that must reach a backend.
2. **Test an integration safely** opens Test Lab for deterministic failures and retries.
3. **Monitor a service** opens Monitoring for availability, latency and contract checks.

Choose one path first. Each page keeps its configuration, evidence and next action together instead
of sending the operator through an unrelated global control screen.

## Workspace map

- **Workspace** — Home summarizes normal routes, monitors, incidents and recent evidence.
- **Build** — Integrations, Test Lab and Scenarios create and validate delivery paths.
- **Operate** — Monitoring and Incidents & recovery show live health and actionable failures.
- **Prove** — Reliability and Evidence turn recorded behavior into an explainable baseline.
- **Resources** — Documentation, API keys and Team workspace support operation and automation.

Account settings remain available from the user profile. OpenAPI import belongs to the Integrations
workflow and is linked from Monitoring and Documentation rather than presented as another top-level
module.

The slim context line above every page identifies the area and current module. The same taxonomy is
used by the desktop sidebar, collapsed rail, mobile More menu and command palette.

## Navigation and precise routes

- `/app` — Home and its three starting actions.
- `/app/live-webhooks` — real Observe and Protect integrations.
- `/app/endpoints` — isolated Test Lab endpoints.
- `/app/scenarios` — deterministic response sequences.
- `/app/control-center/:endpointId` — the delivery timeline for one exact route.
- `/app/monitor` — monitor inventory and selected monitor detail.
- `/app/operations` — incidents, dead letters, recoveries and alert evidence.
- `/app/reliability` — SLO objectives and error-budget evidence.
- `/app/evidence` — redacted event and recovery reports.
- `/app/docs`, `/app/api-keys` and `/app/workspace` — supporting resources.

The old `/app/control-center` entry redirects safely to Home. Saved links containing an endpoint ID
remain valid and open that route's delivery timeline directly.

Integrations accepts `?view=attention` or `?view=paused`. Monitoring accepts `?monitor=<id>`.
Incidents & recovery preserves its view and incident filters in the URL. Home accepts `?window=7`
or `?window=30`; omitting it uses the 24-hour window. These parameters contain navigation state
only, never payloads, credentials or destination URLs.

## Integrations and delivery timelines

Use **Build → Integrations** for real provider traffic. Creation keeps the provider preset, inbound
contract, encrypted destination and Observe or Protect delivery mode in one workflow. After saving,
copy the generated ingestion URL and run the safe smoke test.

Opening a connection leads to its **Delivery timeline**. This is a detail view, not a separate
product module. It contains the selected route's state, URL, correlated attempts, destination
deliveries, Production Readiness and configuration. Links from Home, Monitoring, Incidents &
recovery and Evidence preserve the exact route whenever one is known.

**Observe** forwards once and records both sides. **Protect** persists the event first, retries with
bounded backoff and moves exhausted deliveries to the recovery queue. Protect supports one
destination, Fan-out to every active destination, or ordered Failover after retry exhaustion.
Destination URLs, headers, contracts and signing secrets are encrypted and write-only.

## Test Lab and Scenarios

Use **Build → Test Lab** when the goal is to prove sender behavior without forwarding traffic to a
real backend:

1. Choose a built-in or custom Scenario.
2. Create a Test Lab endpoint and copy its ingestion URL.
3. Use the built-in test runner or send a synthetic request.
4. Open the generated delivery timeline and compare every correlated attempt.
5. Create a separate Integration only when real provider traffic is ready.

Built-in Scenarios cover inspection, rate limiting, temporary outage and unstable services. Custom
Scenarios define ordered status codes, delays, response headers and bodies. Reuse the same event ID
across sender retries so HookTrials groups the attempts into one timeline.

## Monitoring

Create an HTTP monitor with method, expected status range, timeout, cadence and failure threshold,
or an ICMP monitor for host reachability. Optional HTTP contracts can require text or JSON paths.
Run or edit a monitor, inspect latency and availability, then publish selected monitors through a
customizable status page. Pausing a monitor affects active checks only; it never pauses webhook
routes.

## Incidents & recovery

This area combines open and recovered incidents, unresolved dead letters and alert-delivery audit.
**Retry** continues an existing protected delivery. **Replay** creates a new delivery from the
preserved event. Both require confirmation and record operator/source metadata. Check destination
health and idempotency before either action.

## Reliability and Evidence

**Reliability** aggregates monitor checks into availability, latency, SLO and error-budget evidence.
Every state is derived from recorded checks and incidents.

**Evidence** explains an individual event through its result, attempts, deliveries and recovery
timeline. Authenticated JSON/Markdown exports and temporary redacted handoff links are available.
Payload bodies, credentials, signing secrets and destination URLs are excluded from these reports.

## Isolated Demo Lab

Demo Lab is deliberately absent from the normal sidebar, mobile menu and command palette. It is an
optional learning environment reachable from the collapsed help entry on Home or directly at
`/app/demo`.

Its synthetic routes, custom Scenario, monitors, status page, incidents, recoveries and evidence are
tagged to a private demo run. Normal Home metrics and Build, Operate and Prove inventories request
product scope and do not include those records. Demo Lab requests demo scope, shows a permanent
isolation notice and provides scoped cleanup. Existing normal resources are never selected by demo
cleanup.

## Command palette

Press **Cmd + K** on macOS or **Ctrl + K** on Windows and Linux. The palette contains the same normal
destinations as the sidebar plus account, theme, tour, refresh and density actions. Demo Lab is not
advertised there. Keyboard navigation, focus handling and English/Spanish labels follow the rest of
the dashboard.

## Security and data handling

- Use synthetic payloads for tests and avoid unnecessary personal or production data.
- Public status and Evidence links are opaque, redacted and revocable.
- Outbound destinations pass the shared network policy; private CIDRs require an explicit allowlist.
- A local-only self-hosted URL cannot receive cloud-provider traffic. Configure public HTTPS or an
  existing reverse proxy first.

## Troubleshooting order

1. Confirm the exact route or monitor is active.
2. Confirm the public HTTPS URL is reachable outside the host.
3. Read contract and signature evidence before changing validation rules.
4. Inspect the route's delivery timeline, including `Retry-After` and destination outcomes.
5. Open Incidents & recovery only when an incident or dead letter requires action.

Continue with [Getting started](getting-started.md), [Monitoring](monitoring.md),
[Live integrations](live-webhook-hub.md), [Protect mode](protect-mode.md) and
[External access](external-access.md).
