# Evidence and reports

Evidence & reports is the workspace view for understanding what happened to a recorded event,
how delivery recovered and what can be shared with a teammate without exposing the original
request.

## Open a report

1. Open **Resources → Evidence & reports**.
2. Search by route, event correlation key or environment, or filter by endpoint and report state.
3. Select an event to see its explainable score, outcome and recorded time.
4. Use **Open route control** when you need to continue troubleshooting the route itself.

Reports are generated from the event's attempts and destination deliveries. A pending report means
the background report has not finished yet; it is not a failed delivery.

## Read the recovery timeline

The detail view separates the impact from the recovery sequence:

- the outcome describes whether the event was received, delivered, protected, recovered or needs
  attention;
- the impact and duration summarize the observed delivery window;
- the evidence chain shows inbound attempts and downstream deliveries;
- the recovery timeline explains the provider response, destination behavior, retry decisions and
  the next action when one is needed.

This view is intentionally redacted. It does not expose payload bodies, authorization headers,
signing secrets or destination URLs.

## Export or share evidence

Use the **JSON** or **Markdown** actions for an authenticated export of the selected report. These
exports contain the same redacted evidence used in the detail view.

For a handoff, choose **Create 24h link**. The link is temporary and contains no payloads,
credentials, secrets or destination URLs. Anyone who receives it can view the redacted report
until it expires. Creating a new link replaces the previous active link for that report.

## What to do next

- For a route configuration issue, open **Control Center** from the report.
- For a dependency or destination health issue, open **Monitoring**.
- For retries, dead letters, incidents or alerts, open **Operations**.
- For deterministic testing before changing a live integration, use **Lab → Trial endpoints**.

The old `/app/audit` URL redirects to Operations. Redacted operational history remains available
there; Evidence & reports is the place for event-level recovery proof.
