# Scenario Studio

Scenario Studio controls what HookTrials returns on each delivery attempt. It lets you reproduce
temporary outages, rate limits, slow responses and eventual recovery without changing the webhook
sender.

## How a sequence works

HookTrials correlates deliveries that share the same event identifier. The first delivery receives
step 1, its retry receives step 2, and so on. The sender—not HookTrials—decides whether and when to
retry.

Example recipe:

| Attempt | Status | Delay | Header           | Meaning                  |
| ------- | ------ | ----- | ---------------- | ------------------------ |
| 1       | 500    | 0 ms  | —                | Temporary server failure |
| 2       | 429    | 0 ms  | `retry-after: 5` | Ask sender to wait       |
| 3       | 200    | 0 ms  | —                | Recovery and acceptance  |

## Create a custom scenario

1. Open **Failure scenarios** from the Lab workspace.
2. Select **New scenario**, or open a built-in and select **Duplicate to edit**.
3. Give the recipe a descriptive name.
4. Add up to 20 response steps. Each step supports an HTTP status, delay from 0–30 seconds,
   response headers and an optional response body.
5. Reorder steps with **Earlier** and **Later**.
6. Choose whether later retries repeat the final response. If disabled, deliveries beyond the last
   step receive `410 Gone`.
7. Save, then select the scenario when creating an endpoint.

Header input uses a JSON object, for example:

```json
{ "retry-after": "10", "x-test-phase": "limited" }
```

Use only string values. Invalid JSON is not applied.

## Safe editing and deletion

Built-in recipes are immutable so demonstrations remain reproducible. Duplicate one to customize
it. Custom scenario edits affect every endpoint currently using that scenario. A scenario cannot
be deleted while an endpoint uses it; first edit or remove those endpoints.

## Testing guidance

- Use synthetic payloads; retained webhook bodies may contain sensitive data.
- Keep the same provider event ID when manually sending retries, or use the integrated simulator.
- Start with two or three steps so the expected timeline is obvious.
- Add response bodies only when the sender actually branches on them.
- Compare observed retry timing with the sender's documented backoff policy.
