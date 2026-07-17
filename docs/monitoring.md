# Monitoring HTTP and ICMP services

Monitor performs bounded active checks without proxying ordinary traffic. It supports external
APIs, internal APIs, HTTP routes, webhook destinations and ICMP hosts.

## Create or edit a monitor

Open **Monitor** and choose **New monitor**. Select one check type:

- **HTTP / HTTPS:** configure a URL, method, timeout, expected status range and optional response
  text or JSON-path expectations. Authentication headers are encrypted and write-only.
- **ICMP ping:** configure a hostname or IP and timeout. HookTrials records reachability and
  round-trip latency without requiring an HTTP service.

Both types accept environment, interval and consecutive-failure threshold. Select a monitor and use
**Edit** to change its configuration. A saved target or header remains blank in the edit form and is
preserved unless a replacement is entered; secrets and complete target URLs are not returned to the
browser.

HTTP failures are classified as DNS, connection, TLS, timeout, blocked target, HTTP or contract.
ICMP failures are classified as blocked target, DNS, timeout or unreachable. A monitor becomes down
after its configured consecutive failure threshold and automatically recovers after a passing check.

## Read the dashboard

- **Availability 1h / 24h:** passing checks divided by all checks in each exact window.
- **Current / average / p95 latency:** measured request or ping duration, not an estimate.
- **State:** `NEW`, `HEALTHY`, `DEGRADED`, `DOWN` or `PAUSED`.
- **Score:** explainable deductions for availability, latency, contract failures and incidents.
- **Incident:** start time, current cause, duration and recovery summary.

## Network and ICMP requirements

Cloud blocks private, loopback, link-local, metadata and special-use targets for both protocols.
Self-hosted operators may opt into private targets only with explicit CIDR allowlists. DNS answers
are validated before the worker checks the resolved address.

The supplied worker image includes `ping`; Docker Compose grants `NET_RAW` only to that worker. If a
custom runtime removes the capability, ICMP checks fail safely while HTTP monitoring continues.
Some providers and firewalls drop ICMP even when the application is healthy, so use HTTP checks when
application-level health is required.

One-minute checks are the fastest interval. The worker allows at most four checks globally and two
per user at once, and a per-monitor lock prevents overlapping scheduled and manual checks.

## Public status

Use **Status pages** to combine selected monitors into a branded, read-only page. Existing legacy
single-monitor links remain valid. See [Public status pages](public-status-pages.md).
