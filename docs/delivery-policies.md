# Delivery policies

HookTrials Protect routes can send one incoming event to a deliberate delivery topology. The
topology is selected when the route is created or edited in **Product → Webhook Hub**. Trial and
Observe routes keep their existing single-destination behavior.

## Choose a topology

### Single destination

The default sends the event to one destination. HookTrials retries according to the route's retry
profile and records every attempt. This is the right starting point when your backend already has
its own redundancy.

### Fan-out

Fan-out sends the same event to every active target. Use it when two systems must receive the event
independently, for example a production consumer and an audit sink. Each target receives its own
delivery record, retry timeline and status, so one slow target does not hide another target's result.

### Failover

Failover tries the targets in the order shown. The first target receives the normal retry budget;
when it is exhausted, HookTrials queues the next active target and records the hand-off. This is
useful for an active/passive backend or a primary region with a backup region.

Failover is intentionally ordered. It is not load balancing: use Fan-out when all targets must
receive the event.

## Idempotency

Every Protect delivery includes an `X-HookTrials-Idempotency-Key` header. The key is stable across
retries, which lets a consumer safely discard a duplicate request after a timeout or connection
reset.

- **Per destination** (default) creates one key per event and target. This is recommended for
  Fan-out because each consumer can deduplicate independently.
- **Per event** creates one key for the whole event. Choose it when several destinations share a
  common deduplication store.

The key is derived from an internal event identifier and destination identifier. It does not
contain the payload, URL, credentials or personally identifying data.

## Configure safely

1. Open **Webhook Hub** and create a **Protect** route, or edit an existing Protect route.
2. Enter the primary HTTPS destination and choose **Single**, **Fan-out** or **Failover**.
3. Add up to two additional HTTPS targets. For Failover, the first additional target is the first
   fallback in the chain.
4. Choose the idempotency scope and save the route.
5. Send a synthetic event first, then inspect **Control Center**, **Operations** and the route's
   delivery timeline before pointing a provider at the ingestion URL.

Destination URLs and custom headers are write-only. The dashboard shows only target names and
redacted hosts after saving. To replace a policy, re-enter the primary and additional URLs; this
prevents a secret endpoint from being recovered from a browser response.

All policy targets use the same outbound network safeguards as normal Protect delivery. Cloud
routes require public HTTPS targets. Self-hosted installations may allow private targets only when
the operator explicitly enables the private-network policy and supplies the permitted CIDRs.

## What gets recorded

For each target, HookTrials preserves the received event, delivery state, response status, latency,
retry/failover transitions and idempotency key metadata. Payload bodies, authentication headers and
destination URLs remain encrypted or redacted at the same boundaries as the rest of the product.

A failed target opens an incident and remains available in Operations for replay. A successful
fallback does not delete the failed primary evidence; it closes the incident only after a delivery
path has recovered. Fan-out keeps partial failure visible so an unhealthy target cannot be mistaken
for a fully recovered event.

## API shape

The dashboard and API accept a `deliveryPolicy` object on endpoint creation and update. It contains
`strategy`, `idempotencyScope` and one to three `destinations` with a name, HTTPS URL, optional
headers, timeout and expected status range. The API returns only the strategy, scope, count and
redacted target hosts.

Existing endpoints without a policy continue to use the legacy single-destination fields. No
manual migration or data export is required when upgrading.
