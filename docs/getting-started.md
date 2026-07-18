# Getting started

HookTrials is an integration reliability control plane. It helps you test failure handling, operate
webhook traffic and monitor HTTP or ICMP dependencies from one dashboard.

## The three workflows

| Need                         | Start with | Result                                              |
| ---------------------------- | ---------- | --------------------------------------------------- |
| Test how a sender retries    | Trial      | A deterministic failure scenario and retry evidence |
| Inspect real webhook traffic | Observe    | A synchronous provider-to-destination journey       |
| Avoid losing webhook events  | Protect    | Durable queueing, retries and a dead-letter inbox   |
| Check an API or HTTP route   | Monitor    | Availability, latency, contracts and incidents      |

## First safe demonstration

1. Open **Trial endpoints** in the Lab workspace and create an endpoint from a template.
2. Keep the endpoint in **Trial** and choose `Temporary outage then recovery`.
3. Click **Run 3-attempt demo**. No external provider is required.
4. Open the generated event. Inspect inbound attempts, payload stability and the resilience score.
5. Open **Monitor** and create a public HTTP check, or use a self-host allowlist for an internal
   destination.
6. Open **Operations** to inspect incident recovery, dead letters and outgoing alert evidence.

Use synthetic payloads for demonstrations. Captured request bodies are encrypted, but unnecessary
personal or production data should never be sent to a test installation.

## Connect a real destination

Open an endpoint and select **Configure route**. Add the HTTPS destination, optional authentication
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
