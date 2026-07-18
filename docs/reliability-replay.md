# Reliability Replay

Reliability Replay explains one event from provider receipt through validation, delivery and final
recovery. Open any retry timeline from **Control Center** to see it at the top of the authenticated event
inspector.

The replay contains:

- a final outcome: received, delivered, protected, recovered or failed;
- a causal diagnosis grounded in recorded attempts and destination deliveries;
- the visible impact and total recorded time window;
- provider, integrity, delivery and recovery stages;
- an evidence-based operator runbook;
- the existing redacted evidence action and resilience report.

## Deterministic boundary

Replay is not an AI summary. The server derives every statement from HTTP status, delivery state,
signature result, contract result, retry sequence and timestamps already owned by that account.
It does not infer business impact, claim that a downstream application processed an event or expose
payloads in public evidence.

Examples:

- a protected delivery with failed attempts followed by success is **recovered**;
- queued or retrying delivery is **protected**;
- exhausted delivery is **failed** and recommends dead-letter inspection;
- repeated Trial attempts ending in 2xx prove provider retry recovery;
- invalid signature or failed contract becomes the primary diagnosis.

## Compare attempts

For events with multiple inbound attempts, expand **Compare attempt 01 → NN**. The comparison shows
response status, configured delay, signature result, contract result, payload stability and counts
of added, removed or changed headers. Raw payload values remain inside the authenticated inspector.
