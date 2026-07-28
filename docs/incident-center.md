# Incident Center

Operations is the place to triage reliability incidents without losing the evidence that created
them.

## Review the queue

Open **Operations** to see incident status, cause, affected integration and recovery time. Use the
filter to switch between all incidents, open incidents, recovered incidents and incidents that
still need acknowledgement.

The summary keeps the most useful signals visible:

- open incidents;
- open incidents that no operator has acknowledged;
- incidents recovered in the last 24 hours;
- unresolved dead letters and protected recoveries.

## Acknowledge and annotate

Acknowledgement is an operator action, separate from the system's incident state. It records who
took ownership and when. Recovery remains evidence-driven: a monitor or delivery must recover
before HookTrials marks the incident recovered.

Use the note field to record a short handoff, investigation result or follow-up. Notes are scoped
to the installation owner, stored with the incident and can be replaced or cleared. Do not put
secrets, payloads or credentials in a note.

The same controls are available through the authenticated API:

```http
PATCH /v1/incidents/{incidentId}
Content-Type: application/json

{"acknowledged":true,"note":"Provider outage confirmed; watching recovery."}
```

The endpoint only accepts incidents belonging to the authenticated account. It never changes the
captured request body, destination configuration or recovery evidence.

## Alerts and recovery

Outgoing Discord or generic webhook alerts remain an independent delivery channel. A failed alert
does not change the incident state. Use **Alert audit** to verify whether an opening or recovery
notification was delivered.
