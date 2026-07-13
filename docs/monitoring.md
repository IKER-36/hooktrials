# Monitoring APIs and HTTP integrations

Monitor performs bounded active checks without proxying ordinary API traffic. It supports external
APIs, internal APIs, HTTP routes and webhook destinations.

## Create a monitor

Configure name, resource type, environment, URL, method, interval, timeout and expected status
range. Optional expectations can require response text or a JSON path. Authentication headers are
encrypted and write-only.

Checks classify failures as DNS, connection, TLS, timeout, blocked target, HTTP or contract. A
monitor becomes down after its configured consecutive failure threshold and automatically recovers
after a passing check.

## Read the dashboard

- **Availability 1h / 24h:** passing checks divided by all checks in each exact window.
- **Current / average / p95 latency:** request duration evidence, not an estimated score.
- **State:** `NEW`, `HEALTHY`, `DEGRADED`, `DOWN` or `PAUSED`.
- **Score:** deductions for availability, latency, contract failures and open incidents. Every
  deduction includes its evidence.
- **Incident:** start time, current cause, duration and recovery summary.

## Internal targets

Cloud deployments block private, loopback, link-local and metadata destinations. Self-hosted
operators may opt in to private targets only with explicit CIDR allowlists. DNS results and
redirects are validated to prevent bypasses. See [Security](security.md).

One-minute checks are the fastest supported interval. This avoids turning a small installation into
a high-frequency probing service and keeps CubePath Micro-class deployments predictable.

The worker allows at most four checks globally and two checks per user at once. A per-monitor lock
prevents overlapping checks even when a scheduled run and **Run now** coincide.

Release `v0.3.6` includes the worker egress network required for public and explicitly allowlisted
private monitor targets.
