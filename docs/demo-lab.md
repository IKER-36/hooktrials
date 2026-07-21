# Guided Demo

Guided Demo proves the complete HookTrials reliability loop from the dashboard without requiring a
third-party provider. Open **Lab → Guided Demo** and select **Run full demo**.

The run creates a realistic synthetic workspace owned by the signed-in account:

1. **Failure scenarios** receives a custom cascading-provider-outage recipe.
2. **Trial** sends one stable event four times and records `500 -> 503 -> 429 -> 200`.
3. **Observe** uses its own labelled connection, proxies a different event synchronously and records
   a destination failure in Webhook Hub.
4. **Protect** uses a separate GitHub connection, validates a real HMAC signature and inbound header
   contract, accepts the event with `202`, retries it durably and recovers on attempt three.
5. **Monitoring** exercises five integrations: external API, internal API, HTTP route, webhook
   destination and ICMP host. The catalogue contains healthy, degraded, down and recovered states,
   while a customizable public page combines HTTP and ICMP evidence.
6. **Recovery queue** receives a separate protected event whose three failed deliveries exhaust its
   retry budget and leave one real, unresolved dead letter ready for replay or discard.
7. **Operations** receives open and recovered incidents, protected retries and six or more synthetic
   sent-alert audit entries.
8. **Evidence** publishes an expiring, redacted report for the signed, protected recovery.

The completed workspace retains three clearly labelled **DEMO DATA** connections in Webhook Hub:
one Observe failure, one Protect recovery and one Protect dead letter. The recovered GitHub route is
selected automatically in Control Center. It proves every Production Readiness control in Cloud;
local-only installations correctly leave only the public-HTTPS check unproven.

This is real application behavior: webhook traffic passes through the public ingestor, protected
delivery and monitor checks run on BullMQ workers, and reports are produced by the normal analysis
pipeline. Only alert delivery is deliberately simulated for demo-owned incidents so running the lab
can never notify a real channel configured by the user.

The endpoint URLs use the normal public ingestion origin in Cloud. Self-hosted installations use an
internal ingestor URL only for server-to-server demo traffic, while the browser continues to use the
configured public or local origin.

## Recovery and cleanup boundary

Every resource created by setup receives a random `demoRunId` in private resource metadata. Cleanup
requires an authenticated user and explicit confirmation, then matches both that user ID and the
exact run ID. The demo-owned status page is removed by its stored ID before integration cascades;
then endpoints, events, deliveries, monitors, checks, incidents and evidence follow normal database
cascades. The exact custom scenario and a demo-owned alert channel are also removed by stored IDs;
an existing user status page or alert channel is never deleted or overwritten.

The browser queries the API for an existing private run when Guided Demo opens. Closing or reloading the
browser therefore cannot lose the cleanup control. If one run is found, **Reset demo workspace**
removes it. If historical interrupted runs exist, reset removes every demo-tagged run owned by that
account while preserving all normal resources.

**Clean only this demo run** remains limited to the run created in the current browser journey.
Cleanup never matches names or prefixes and cannot touch another user's resources.

Only use synthetic payloads. Demo endpoints use temporary reserved Cloud capacity and do not consume
the normal endpoint quota shown to the user. A second run cannot start while demo resources exist.
