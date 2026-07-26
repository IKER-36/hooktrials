# Incidents, alerts and evidence

HookTrials opens incidents from active monitor failures, webhook validation failures and downstream
delivery failures. Recovery is automatic when passing evidence arrives.

## Outgoing alert channel

Open **Operations** and choose one delivery provider:

- **Generic webhook** sends stable JSON to an HTTPS URL and supports optional encrypted headers.
- **Discord** sends a native embed to a Discord incoming-webhook URL with mentions disabled.

Then choose which incident sources and lifecycle events should notify that channel independently:

- Monitor incidents.
- Webhook validation or destination-delivery incidents.
- Incident opened.
- Incident recovered.

At least one source and one lifecycle event must remain enabled. Use **Send test** before relying on
the channel. Recent delivery state, status and latency are visible in Operations; destination URLs,
encrypted headers, captured payloads and other secrets are never returned to the browser.

An existing URL remains write-only when preferences are edited, so changing scopes does not require
re-entering it. Changing from generic webhook to Discord clears obsolete custom headers. Treat a
generic receiver like any other integration: authenticate it, return quickly and deduplicate by
incident and event identifiers.

## Operations queue

The Operations page combines open/recovered incidents, unresolved dead letters, manual retry/replay
and outgoing alert audit. Resolved dead letters remain available as evidence but are hidden by
default. Every recovery action requires confirmation and records its source and requesting user.

## Downloadable evidence

Open an event and download either:

- **JSON evidence** for automation, CI artifacts and structured archival.
- **Markdown evidence** for a human-readable incident review or change record.

Both formats are generated server-side from the same redacted evidence model used by public links.
They exclude payload bodies, captured headers, credentials, signing material and destination URLs.
The authenticated download is produced on demand and does not make the event public.

## Shareable evidence

Open an event and choose **Create 24h share link**. After confirmation, HookTrials creates a random,
hashed and expiring token. The public read-only page contains:

- integration name, mode and environment;
- event correlation and body hash;
- inbound statuses plus signature and contract outcomes;
- downstream statuses, latency, retries and recovery;
- the explainable resilience score.

Payload bodies, captured headers, credentials, secrets and destination URLs are excluded. The
public page can also download the same redacted JSON or Markdown without exposing the underlying
authenticated event. Revoke the link from the same event when it is no longer needed. Evidence
links are diagnostic artifacts, not an authorization mechanism or permanent audit archive.
