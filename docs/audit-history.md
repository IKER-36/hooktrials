# Audit history

HookTrials keeps a redacted record of operational changes so a team can explain what happened
without searching application logs. Audit entries are surfaced inside **Operations**, next to
incidents, dead letters and notification delivery. The former `/app/audit` URL remains as a
compatibility redirect to Operations so saved links continue to work.

The history includes actions such as:

- creating, editing, pausing and deleting routes or monitors;
- running synthetic tests and manual recovery actions;
- acknowledging incidents and changing alert configuration;
- creating or revoking API keys;
- actions performed through the CLI or another scoped API key.

Each entry shows the action, affected resource, result status, actor type and timestamp. Request
bodies, webhook payloads, destination URLs, authorization headers, API key secrets and other
credentials are never copied into the audit record.

The history is account-scoped and can be used as a lightweight change record during an incident or
handoff. It is not a permanent archive of event payloads; use evidence exports for a specific
delivery timeline.

## API

Authenticated clients can read the same redacted history with:

```text
GET /v1/audit-events?limit=100
```

Optional `entityType` and `before` parameters support filtering and pagination. The response never
returns secrets or raw payloads.
