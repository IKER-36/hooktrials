# Isolated Demo Lab

Demo Lab proves the complete HookTrials reliability loop without requiring a third-party provider.
It is deliberately hidden from the normal navigation so synthetic work cannot be mistaken for the
product workspace. Expand **Need a guided example?** on Home, or open `/app/demo` directly, and
select **Run full demo**.

The run creates a realistic synthetic workspace owned by the signed-in account:

1. **Scenarios** receives a custom cascading-provider-outage recipe.
2. **Trial** sends one stable event four times and records `500 -> 503 -> 429 -> 200`.
3. **Observe** uses its own labelled connection, proxies a different event synchronously and records
   a destination failure in the isolated Integrations dataset.
4. **Protect** uses a separate GitHub connection, validates a real HMAC signature and inbound header
   contract, accepts the event with `202`, retries it durably and recovers on attempt three.
5. **Monitoring** exercises five integrations: external API, internal API, HTTP route, webhook
   destination and ICMP host. The catalogue contains healthy, degraded, down and recovered states,
   while a customizable public page combines HTTP and ICMP evidence.
6. **Recovery queue** receives a separate protected event whose three failed deliveries exhaust its
   retry budget and leave one real, unresolved dead letter ready for replay or discard.
7. **Incidents & recovery** receives open and recovered incidents, protected retries and six or more synthetic
   sent-alert audit entries.
8. **Evidence** publishes an expiring, redacted report for the signed, protected recovery.

The completed workspace retains three demo-owned connections inside the isolated environment: one
Observe failure, one Protect recovery and one Protect dead letter. The recovered GitHub route can be
opened in its Delivery timeline. It proves every Production Readiness control in Cloud;
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

Setup, cleanup and reset acquire one short-lived Redis lock scoped to the authenticated user.
Only one demo mutation can run for that account at a time; a concurrent request receives an
explicit conflict response and can be retried after the active operation finishes. Lock release is
token-checked so one operation cannot release another operation's lock, and the expiry remains a
safety net if a process stops unexpectedly.

The browser queries the API for an existing private run when Demo Lab opens. Closing or reloading the
browser therefore cannot lose the cleanup control. If one run is found, **Reset demo workspace**
removes it. If historical interrupted runs exist, reset removes every demo-tagged run owned by that
account while preserving all normal resources.

**Clean only this demo run** remains limited to the run created in the current browser journey.
Cleanup never matches names or prefixes and cannot touch another user's resources.

Only use synthetic payloads. Demo endpoints use temporary reserved Cloud capacity and do not consume
the normal endpoint quota shown to the user. A second run cannot start while demo resources exist
or another setup/cleanup/reset operation is active.

## Product visibility boundary

Normal Home, Integrations, Test Lab, Scenarios, Monitoring, Incidents & recovery, Reliability and
Evidence reads explicitly request `product` scope. Demo Lab requests `demo` scope for the evidence
it verifies. Custom demo Scenarios are identified through their demo-owned endpoint relationships,
and demo status pages are excluded from the normal monitoring inventory. Direct API clients remain
backwards compatible because omitting `scope` returns all user-owned resources.
