# Contracts and webhook signatures

Contracts reject structurally invalid traffic before it reaches a destination. Signature presets
prove that the request was signed with the configured shared secret.

## Inbound contracts

A route contract can assert:

- HTTP method;
- required header names and optional exact values;
- JSON paths and expected scalar values;
- the destination's accepted status range.

JSON paths use a bounded dot format such as `$.data.ready`. A failed inbound contract returns `422`,
records each check and opens a validation incident. No destination call is attempted.

## GitHub preset

Choose **GitHub**, enter the webhook secret and configure GitHub to send the
`X-Hub-Signature-256` header. HookTrials verifies the HMAC-SHA256 signature over the exact request
body. Missing or invalid signatures return `401`.

## Stripe preset

Choose **Stripe**, enter the endpoint signing secret and select a timestamp tolerance. HookTrials
verifies a `v1` signature from `Stripe-Signature` and rejects stale timestamps. Keep the default
tolerance unless clock behavior gives a concrete reason to change it.

Secrets and destination authentication headers are encrypted at rest and never returned by the API.
The dashboard only reports whether a secret is configured. Re-enter a secret only when rotating it.

## Provider starters

Route control includes four starters:

- **Stripe:** POST contract plus native `Stripe-Signature` verification;
- **GitHub:** delivery/event headers plus native `X-Hub-Signature-256` verification;
- **Shopify:** POST contract and required topic, webhook-ID and HMAC header presence;
- **Slack:** POST contract and required timestamp/signature header presence.

Stripe and GitHub perform native cryptographic verification. Shopify and Slack starters verify the
expected header surface but do not claim native HMAC verification. Always review a starter before
saving it and provide a real secret only through the encrypted route form.
