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
