# Demo Lab

Demo Lab proves the complete HookTrials reliability loop from the dashboard without requiring a
third-party provider. Open **Demo Lab** and select **Run full demo**.

The run creates two synthetic test endpoints and one paused monitor owned by the signed-in account:

1. **Trial** sends one stable event three times and records `500 -> 500 -> 200`.
2. **Observe** proxies a different event synchronously and records a destination failure.
3. **Protect** accepts a new event with `202`, retries it durably and recovers on attempt three.
4. **Monitor** performs three immediate POST checks, opens an incident and records its recovery.
5. **Operations** confirms the resulting incident, delivery and recovery evidence.

The endpoint URLs use the normal public ingestion origin in Cloud. Self-hosted installations use an
internal ingestor URL only for server-to-server demo traffic, while the browser continues to use the
configured public or local origin.

## Cleanup boundary

Every resource created by setup receives a random `demoRunId` in private resource metadata. Cleanup
requires an authenticated user and explicit confirmation, then matches both that user ID and the
exact run ID. Endpoints are removed before their integration resources so owned events, deliveries,
monitors, checks and incidents follow normal database cascades.

Cleanup never matches names or prefixes and cannot touch another user's resources. If a browser is
closed before cleanup, the resources remain ordinary test endpoints and monitors that can be
inspected; no background destructive cleanup is performed.

Only use synthetic payloads. Cloud accounts need capacity for two temporary endpoints before setup.
