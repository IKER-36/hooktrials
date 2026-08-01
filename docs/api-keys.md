# API keys and automation

API keys let a CI job run a synthetic check or export redacted evidence without keeping a browser
session alive. They are account-scoped and can be revoked independently.

## Create a key

Open **Resources → API keys** in the dashboard. Give the key a recognizable name such as
`github-actions-staging` and choose the smallest permission set:

- **read** exports redacted JSON or Markdown evidence;
- **write** runs a synthetic check against an existing Observe or Protect endpoint.

The secret is shown once. Copy it directly into your CI secret store. HookTrials stores only a hash,
never the raw key, and the dashboard displays only its prefix after creation.

## Run from CI

Store these secrets in your pipeline:

```bash
export HOOKTRIALS_API_ORIGIN='https://api.hooktrials.com'
export HOOKTRIALS_API_KEY='htk_...'
```

Build the CLI from a checked-out HookTrials release, then run a synthetic event:

```bash
pnpm --filter @hooktrials/cli build
pnpm exec hooktrials-run \
  --endpoint-id "$HOOKTRIALS_ENDPOINT_ID" \
  --api-origin "$HOOKTRIALS_API_ORIGIN" \
  --api-key "$HOOKTRIALS_API_KEY" \
  --evidence \
  --format json \
  --output hooktrials-evidence.json
```

The command prints the recorded event ID, destination status and latency. When `--evidence` is
present it immediately downloads the same redacted evidence model used by the dashboard. The write
key is used for the synthetic run; use a separate read-only key for evidence export in stricter
pipelines.

The same CLI can verify that an installation publishes its API contract:

```bash
pnpm exec hooktrials-api \
  --api-origin "$HOOKTRIALS_API_ORIGIN" \
  --operation-id runAutomationEvent
```

See [API catalogue](api-catalogue.md) for discovery and export options.

To export an existing event later:

```bash
pnpm exec hooktrials-evidence \
  --event-id "$HOOKTRIALS_EVENT_ID" \
  --api-origin "$HOOKTRIALS_API_ORIGIN" \
  --api-key "$HOOKTRIALS_READ_KEY" \
  --format markdown \
  --output hooktrials-evidence.md
```

Only IDs, status codes, timing and the redacted report leave the API. Payload bodies, captured
headers, destination URLs, signing secrets and API key values are not included in the export.

## Rotation and revocation

Create a replacement key before rotating a pipeline, update the CI secret, run one synthetic check,
then revoke the old key from **Resources → API keys**. A revoked key returns `401` and cannot be
restored. Never commit keys, put them in YAML files or print authorization headers in CI logs.
