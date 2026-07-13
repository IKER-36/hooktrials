# Incidents, alerts and evidence

HookTrials opens incidents from active monitor failures, webhook validation failures and downstream
delivery failures. Recovery is automatic when passing evidence arrives.

## Outgoing alert channel

Open **Monitor**, configure an HTTPS webhook URL and optionally encrypted headers, then send a test.
HookTrials emits redacted `opened` and `recovered` events. Recent delivery state, status and latency
are visible in the panel; secrets and captured payloads are excluded.

Treat the receiver like any other integration: authenticate it, return quickly and deduplicate by
incident and event identifiers.

## Shareable evidence

Open an event and choose **Create 24h share link**. After confirmation, HookTrials creates a random,
hashed and expiring token. The public read-only page contains:

- integration name, mode and environment;
- event correlation and body hash;
- inbound statuses plus signature and contract outcomes;
- downstream statuses, latency, retries and recovery;
- the explainable resilience score.

Payload bodies, captured headers, credentials, secrets and destination URLs are excluded. Revoke the
link from the same event when it is no longer needed. Evidence links are diagnostic artifacts, not
an authorization mechanism or permanent audit archive.
