# Webhook Hub and live traffic

Webhook Hub is the production-facing entry point for real webhook traffic. It places HookTrials
between an external provider and the application that normally receives the request.

```text
provider -> HookTrials public ingestion URL -> validation -> delivery -> your backend
                         |                       |              |
                         +-> encrypted evidence +-> incident   +-> retry / dead-letter
```

HookTrials is an explicit intermediary, not a passive network sniffer. The provider must be
configured to call the private HookTrials ingestion URL. The backend URL then becomes the encrypted
destination of that route.

## What the hub provides

- one dashboard for Stripe, GitHub, Shopify, Slack and generic webhook providers;
- complete inbound method, headers, body, timestamps and correlation evidence;
- native Stripe and GitHub signature verification;
- method, header and JSON-path contracts before forwarding;
- destination status, latency, response size and failure classification;
- a single event journey from provider to HookTrials, validation, destination and provider response;
- incidents, recovery evidence, alerting and manual dead-letter operations;
- encrypted payloads, destinations, destination headers and signing secrets at rest.

The current route model connects one provider-facing ingestion URL to one destination. Create
multiple routes to concentrate different providers and backends in the same workspace.

## Create a live connection

1. Open **Live Webhooks** and select **Connect a real webhook**.
2. Choose the provider. Provider starters configure an inbound POST contract; Stripe and GitHub
   support native signature verification.
3. Enter the public HTTPS URL that currently receives the webhook.
4. Optionally enter an existing signing secret, then choose **Observe** or **Protect**.
5. Select the environment. Production requires explicit acknowledgement because HookTrials becomes
   part of the delivery path.
6. Create the connection and copy its private HookTrials URL.
7. Replace the old destination in the provider configuration with this URL.
8. If the provider issues its signing secret only after URL registration, paste it into the
   activation panel before accepting real traffic.
9. Send the provider's test event and open **Live inspector**.

The connection is created atomically: route, encrypted destination, contract, signature settings and
public token are committed together. A failed validation does not leave a partially configured live
route.

## Observe versus Protect

### Observe

```text
provider -> HookTrials -> destination -> HookTrials -> provider
```

Observe forwards synchronously once. It returns the destination status and selected response headers
to the provider. Use it when the provider owns retry policy and you need a transparent operational
record of both sides.

If the destination times out or cannot be reached, HookTrials returns `502` or `504`, records the
failure and opens an incident. The provider can then apply its normal retry behavior.

### Protect

```text
provider -> validate -> persist -> 202 Accepted
                              -> durable queue -> destination
                                               -> retry -> dead-letter
```

Protect acknowledges a valid event after durable persistence and delivers it asynchronously. It
uses bounded exponential backoff, respects safe `Retry-After` values and moves exhausted deliveries
to the Recovery Queue.

Use Protect when HookTrials should own downstream recovery. The destination must implement
idempotency: no distributed system can prove whether a response was lost after a backend committed
the operation.

## Real examples

### Payment completed

Configure Stripe to call HookTrials instead of the store backend. HookTrials verifies
`Stripe-Signature`, checks the contract and forwards the exact body. If the store is unavailable in
Protect mode, the payment event remains queued until delivery succeeds or an operator handles its
dead letter.

### GitHub deployment automation

Configure a GitHub webhook with the HookTrials URL and shared secret. Invalid signatures are rejected
before the CI backend is called. Valid deliveries retain the GitHub event and delivery identifiers,
destination latency and response outcome.

### Central integration workspace

Create separate routes for billing, source control, commerce and internal automation. Each route has
its own private URL, destination, validation and environment while Operations provides one incident,
dead-letter and alert queue for the account.

## Cloud and self-hosted operation

HookTrials Cloud issues URLs under `https://hooks.hooktrials.com/i/...` and only permits public
destinations. Private, loopback, metadata and special-use networks are blocked.

Self-hosted installations can receive Internet providers after configuring a public HTTPS domain or
reverse proxy. Explicit private CIDR access is available only in self-hosted mode. Follow
[External access](external-access.md) before changing a real provider.

## Production checklist

- start in a provider sandbox or staging environment;
- verify the first captured request and destination response;
- enable a native signature secret where supported;
- define the smallest useful inbound contract;
- make the destination idempotent before using Protect;
- configure alert delivery and review the Recovery Queue;
- keep retention, backups and encryption keys operationally protected;
- document the HookTrials URL as part of the integration inventory;
- retain the previous provider destination for rollback.

Do not place authentication middleware in front of `/i/*`; providers cannot complete an interactive
login. The ingestion URL itself is a high-entropy secret and should be rotated by replacing the route
if it is exposed.

Continue with [Protect mode](protect-mode.md), [Contracts and signatures](contracts-and-signatures.md),
[Product guide](product-guide.md) and [Security](security.md).
