# Guided demonstration

HookTrials is the webhook receiver. It does not retry outgoing requests: it returns controlled HTTP
responses so a webhook provider can demonstrate its own retry behavior. HookTrials correlates
deliveries carrying the same event identifier into one timeline.

## Fastest path

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
