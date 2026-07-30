# Protect mode

Protect mode durably accepts a valid webhook before delivering it to your destination.

```text
provider -> validate -> persist -> 202 Accepted -> queue -> destination
                                             -> retry -> dead-letter
```

## Delivery behavior

- one idempotent initial delivery is created per correlated event;
- retries use bounded exponential backoff with jitter;
- safe `Retry-After` values are respected;
- destination concurrency is limited;
- exhausted deliveries enter the dead-letter state;
- successful recovery closes the related incident.

Configure maximum attempts and backoff in the route panel. Keep values conservative until the
destination's rate limits and idempotency behavior are known.

## Delivery identity and retry profiles

Every delivery sent to your destination includes stable HookTrials headers:

- `x-hooktrials-event-id` identifies the provider event across all attempts;
- `x-hooktrials-delivery-id` identifies the specific forward, retry or replay delivery;
- `x-hooktrials-delivery-attempt` identifies the attempt number for that delivery.

Use `x-hooktrials-event-id` as the idempotency key in the destination before enabling Protect. The
same event is accepted and correlated once even when a provider retries it; a replay gets a new
delivery ID while retaining its source in the audit trail.

Route control offers Fast, Balanced and Patient retry profiles, or a Custom policy. Profiles set the
maximum attempts and exponential backoff bounds. A destination's `Retry-After` response is respected
but never exceeds the configured maximum delay.

## Retry versus replay

- **Retry** continues a failed or dead-letter delivery.
- **Replay** creates a clearly labelled new delivery from existing evidence.

Both actions require confirmation and record the user, source delivery and request time. Your
destination should still implement idempotency: HookTrials prevents duplicate queue jobs, but no
network can prove whether a response was lost after a destination committed work.

## Operational responsibility

In Protect mode HookTrials owns downstream recovery. Monitor its queue, incidents and alert channel.
Back up PostgreSQL because event and delivery state is durable there; Redis coordinates work but is
not the source of truth.

The current release includes the dual-network worker topology required for protected deliveries. Keep
the data network internal and the edge network egress-capable.
