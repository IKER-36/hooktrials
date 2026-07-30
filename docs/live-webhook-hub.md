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

- one dashboard for Stripe, GitHub, Shopify, Slack, GitLab, Linear, HubSpot and generic webhook
  providers, with a provider-specific contract starter for each;
- complete inbound method, headers, body, timestamps and correlation evidence;
- native Stripe and GitHub signature verification;
- method, header and JSON-path contracts before forwarding;
- destination status, latency, response size and failure classification;
- a single event journey from provider to HookTrials, validation, destination and provider response;
- incidents, recovery evidence, alerting and manual dead-letter operations;
- encrypted payloads, captured request headers, destinations, destination headers and signing
  secrets at rest.

The current route model connects one provider-facing ingestion URL to one destination. Create
multiple routes to concentrate different providers and backends in the same workspace. Provider
starters configure the expected method and header surface; native cryptographic verification is
currently available for Stripe and GitHub, while the other starters remain contract-first.

## Create a live connection

1. Open **Webhook Hub** in the Product workspace and select **Connect a real webhook**.
2. Choose the provider. Provider starters configure an inbound POST contract; Stripe and GitHub
   support native signature verification, while the other starters validate the expected header
   surface before delivery.
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

## Validate before provider cutover

Every live connection exposes two explicit, safe validation actions:

1. **Run destination preflight** checks outbound network policy, DNS resolution, TLS and HTTP
   reachability without sending a webhook payload. It also reports whether the configured inbound
   contract and provider signature settings are ready.
2. **Send safe test event** creates a synthetic provider-shaped request and sends it through the
   real public ingestion URL, validation pipeline and configured destination. GitHub and Stripe
   starters generate their native signatures when a signing secret is configured.

The synthetic event is clearly identified in captured evidence and never reuses a production
payload. It can still reach the configured destination, so point a new route at staging or a
side-effect-free handler until idempotency and filtering have been verified. Neither action runs
automatically when the route is created.

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
- run destination preflight, then send the explicit safe test event;
- verify the first captured request and destination response;
- enable a native signature secret where supported;
- define the smallest useful inbound contract;
- make the destination idempotent before using Protect;
- configure alert delivery and review the Recovery Queue;
- keep retention, backups and encryption keys operationally protected;
- document the HookTrials URL as part of the integration inventory;
- retain the previous provider destination for rollback.

The Webhook Hub activation path in Control Center mirrors this checklist at account level. Use it
to confirm that a Trial has produced evidence, that the real route is connected, that at least one
dependency is monitored and that Operations has been reviewed before moving a provider out of
staging.

Do not place authentication middleware in front of `/i/*`; providers cannot complete an interactive
login. The ingestion URL itself is a high-entropy secret. If it is exposed, rotate it from an
authenticated client with `POST /v1/endpoints/:id/rotate` and body `{"confirm":true}`; the previous
URL stops working immediately.

Continue with [Protect mode](protect-mode.md), [Contracts and signatures](contracts-and-signatures.md),
[Product guide](product-guide.md) and [Security](security.md).
