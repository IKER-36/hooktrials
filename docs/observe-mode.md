# Observe mode

Observe mode records a real webhook journey while preserving synchronous provider semantics.

```text
provider -> HookTrials -> signature + contract -> destination -> mirrored response
```

## Configure it

1. Add an HTTPS destination and any required encrypted headers.
2. Set timeout and expected destination status range.
3. Optionally enable a signature preset and inbound contract.
4. Select **Observe**. Confirm explicitly when the environment is production.
5. Send a test event before switching the provider permanently.

HookTrials forwards once. The provider receives the destination status and response. A timeout,
blocked target or destination failure therefore remains visible to the provider and its own retry
policy.

## When to use it

Use Observe when exact synchronous behavior matters, when you are adopting HookTrials gradually or
when the provider requires the destination result. Use Protect when HookTrials should accept the
provider event first and own downstream recovery.

Pausing an active route stops its webhook traffic. Pausing a monitor never pauses webhook traffic.
