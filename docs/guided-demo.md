# Guided competition demonstration

HookTrials is the webhook receiver. It does not retry outgoing requests: it returns controlled HTTP
responses so a webhook provider can demonstrate its own retry behavior. HookTrials correlates
deliveries carrying the same event identifier into one timeline.

## Part 1: prove provider retry behavior

1. Open **Endpoints**.
2. Select **Worst-day sequence**.
3. Create the prefilled `resilience-demo` endpoint.
4. On **Overview**, press **Run 4-attempt demo**.
5. Open the generated event in **Retry timelines**.

The built-in provider simulator sends the same synthetic event four times. The endpoint responds:

```text
500 Internal Server Error
503 Service Unavailable, delayed by 3 seconds
429 Too Many Requests, with Retry-After: 8
200 OK
```

The inspector then shows the complete payload, sanitized headers, request path, response selected
for each attempt, delay, body hash and generated resilience report.

## Included endpoint templates

| Template            | Response sequence       | Demonstrates                           |
| ------------------- | ----------------------- | -------------------------------------- |
| Payload inspector   | `200`                   | Headers, body and request metadata     |
| Retry recovery      | `500 → 500 → 200`       | Recovery after temporary failure       |
| Rate-limit handling | `429 → 200`             | `Retry-After` and throttling behavior  |
| Worst-day sequence  | `500 → 503 → 429 → 200` | Full retry timeline and final recovery |

## Test manually

Copy the endpoint URL and send the same payload once for every scenario step:

```bash
curl -X POST 'http://localhost:3000/i/YOUR_ENDPOINT_TOKEN' \
  -H 'content-type: application/json' \
  -d '{"event":"synthetic.test","id":"demo-001"}'
```

Repeat the command without changing `id`. HookTrials uses known delivery headers, an `id` field or
the payload hash to correlate attempts. Change `id` to start an independent event timeline.

Use synthetic payloads only. Do not send customer secrets, production credentials or unnecessary
personal data to a test installation.

## Part 2: observe the complete journey

1. Create a second **Payload inspector** endpoint to act as a synthetic backend.
2. Copy its ingest URL.
3. Configure `resilience-demo` with that URL as destination, private CIDR allowlisting only when the
   self-host Docker network requires it, and switch to **Observe**.
4. Send one event.

The event now separates provider receipt from destination delivery. The inspector shows signature
and contract validation, destination status and latency. Observe mirrors the backend result to the
sender.

## Part 3: protect and recover an event

1. Point the route at a synthetic backend using `Temporary outage then recovery`.
2. Switch to **Protect** and set three maximum attempts.
3. Send one event. The provider receives `202` after durable persistence.
4. Watch automatic deliveries fail, retry and succeed.
5. Repeat with too few attempts to produce a dead letter; confirm a manual retry.

The incident opens on downstream failure and closes on success. The timeline records automatic and
manual delivery source, retry state and recovery without mixing them with inbound attempts.

## Part 4: monitor and explain

1. Open **Monitor** and add a public API, HTTP route or explicitly allowlisted internal API.
2. Run a passing check to establish a baseline.
3. Make the synthetic target fail long enough to cross its incident threshold.
4. Restore it and run again.

Show availability, average/p95 latency, classified cause, incident duration and score deductions.
Configure the outgoing alert channel to demonstrate redacted `opened` and `recovered` notifications.

## Part 5: validation and evidence

Enable a GitHub or Stripe signature preset and an inbound method/header/JSON contract. Demonstrate
that unsigned traffic receives `401`, invalid contract traffic receives `422`, and neither reaches
the destination. Send a valid event to recover the validation incident.

Finally create a 24-hour evidence link from the event. Open it signed out and point out that it proves
the end-to-end result while intentionally excluding payloads, captured headers, credentials, secrets
and destination URLs.
