# Trial mode

Trial mode is a deterministic webhook failure lab. The webhook sender calls HookTrials instead of
your application and receives the configured scenario responses.

## Use it for

- proving that a provider retries `500`, `503` or `429` responses;
- checking whether the payload and event identifier remain stable across retries;
- measuring retry timing;
- reproducing an incident without making a real backend fail.

## Run a trial

1. Create an endpoint and leave its mode set to **Trial**.
2. Select a built-in scenario or create one in **Failure scenarios**.
3. Copy the ingest URL into a provider's webhook configuration, or use the dashboard simulator.
4. Open the live event after the first request.
5. Compare response sequence, delays, attempt count, correlation identifier and report deductions.

Scenario steps can set status, delay, headers and a bounded response body. With **Repeat last step**
enabled, later requests keep receiving the final response. Without it, the sequence restarts.

## What Trial does not do

Trial does not call your destination. Use Observe to inspect synchronous forwarding or Protect to
exercise durable downstream recovery. Do not interpret a successful Trial report as proof that your
backend is healthy; it proves sender retry behavior.
