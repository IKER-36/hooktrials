# Demo Lab

Demo Lab proves the complete HookTrials reliability loop from the dashboard without requiring a
third-party provider. Open **Demo Lab** and select **Run full demo**.

The run creates a realistic synthetic workspace owned by the signed-in account:

1. **Scenario Studio** receives a custom cascading-provider-outage recipe.
2. **Trial** sends one stable event four times and records `500 -> 503 -> 429 -> 200`.
3. **Observe** proxies a different event synchronously and records a destination failure.
4. **Protect** accepts a new event with `202`, retries it durably and recovers on attempt three.
5. **Monitor** exercises four integrations: external API, internal API, HTTP route and webhook
   destination. The resulting catalogue contains healthy, degraded, down and recovered states.
6. **Operations** receives an open incident, recovered incidents, protected retries and five or more
   synthetic sent-alert audit entries.
7. **Evidence** publishes an expiring, redacted report for the recovered Trial sequence.

This is real application behavior: webhook traffic passes through the public ingestor, protected
delivery and monitor checks run on BullMQ workers, and reports are produced by the normal analysis
pipeline. Only alert delivery is deliberately simulated for demo-owned incidents so running the lab
can never notify a real channel configured by the user.

The endpoint URLs use the normal public ingestion origin in Cloud. Self-hosted installations use an
internal ingestor URL only for server-to-server demo traffic, while the browser continues to use the
configured public or local origin.

## Cleanup boundary

Every resource created by setup receives a random `demoRunId` in private resource metadata. Cleanup
requires an authenticated user and explicit confirmation, then matches both that user ID and the
exact run ID. Endpoints are removed before their integration resources so owned events, deliveries,
monitors, checks, incidents and evidence follow normal database cascades. The exact custom scenario
and a demo-owned alert channel are also removed by stored IDs; an existing user alert channel is
never deleted or overwritten.

Cleanup never matches names or prefixes and cannot touch another user's resources. If a browser is
closed before cleanup, the resources remain ordinary test endpoints and monitors that can be
inspected; no background destructive cleanup is performed.

Only use synthetic payloads. Cloud accounts need capacity for two temporary endpoints before setup.
