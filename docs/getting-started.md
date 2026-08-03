# Getting started

HookTrials is an integration reliability control plane. It helps you test failure handling, operate
webhook traffic and monitor HTTP or ICMP dependencies from one dashboard.

## Choose a starting action

| Need                         | Start with   | Result                                              |
| ---------------------------- | ------------ | --------------------------------------------------- |
| Test how a sender retries    | Test Lab     | A deterministic failure scenario and retry evidence |
| Inspect real webhook traffic | Integrations | A synchronous Observe delivery timeline             |
| Avoid losing webhook events  | Integrations | Protect queueing, retries and recovery              |
| Check an API or HTTP route   | Monitoring   | Availability, latency, contracts and incidents      |

## First safe demonstration

1. Open **Build → Test Lab** and create an endpoint from a template.
2. Keep the endpoint in **Trial** and choose `Temporary outage then recovery`.
3. Click **Run 3-attempt test**. No external provider is required.
4. Open the generated event. Inspect inbound attempts, payload stability and the resilience score.
5. Open **Monitoring** and create a public HTTP check, or use a self-host allowlist for an internal
   destination.
6. Open **Incidents & recovery** to inspect recovery, dead letters and alert evidence.

Use synthetic payloads for demonstrations. Captured request bodies are encrypted, but unnecessary
personal or production data should never be sent to a test installation.

## The first five minutes

After creating the first Test Lab endpoint, its **Delivery timeline** shows an activation path that follows
the evidence HookTrials can actually observe. Complete it in any order:

1. Run the test runner or send the generated `curl` request and open the first event timeline.
2. Create a real route in **Integrations** when a provider should reach your backend.
3. Add one monitor for an API, route or webhook destination.
4. Review **Incidents & recovery** for incidents, recoveries, dead letters and alert evidence.

The path is informational and never creates resources automatically. A step becomes **Proven** only
when the corresponding workspace evidence exists, so it doubles as a quick hand-off checklist for a
new team member.

## Connect a real destination

Open **Integrations** and create or edit a route. Add the HTTPS destination, optional authentication
headers, expected response range and timeout. Then choose:

- **Observe** when the provider must receive the destination response synchronously.
- **Protect** when accepting and durably recovering the event matters more than a synchronous
  destination response.

Test and staging are visually distinct from production. Changing a production route requires an
explicit impact confirmation.

## Understand evidence

An event separates two different facts:

- **Inbound attempt:** the provider reached HookTrials; signature and request contract were checked.
- **Destination delivery:** HookTrials called your backend; status, latency, retries and recovery
  were measured.

This separation makes the diagnosis useful: a provider problem, validation problem and destination
problem no longer look like the same generic webhook failure.

Next: [Trial](trial-mode.md), [Observe](observe-mode.md), [Protect](protect-mode.md),
[Monitoring](monitoring.md).
