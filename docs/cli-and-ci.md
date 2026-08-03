# CLI and CI trials

HookTrials can turn a dashboard scenario into a repeatable development gate. The CLI sends one
stable synthetic event through every declared attempt, checks the exact HTTP sequence and exits
non-zero when reality differs from the contract.

## Run locally

Create a Trial endpoint with the **Temporary outage** scenario, then keep its private URL outside
source control:

```bash
export HOOKTRIALS_ENDPOINT_URL='https://your-hooktrials.example/i/ht_private_token'
pnpm --filter @hooktrials/cli build
pnpm exec hooktrials-trial --config examples/payment-webhook.trial.yml \
  --json hooktrials-result.json --junit hooktrials-junit.xml
```

The command expects `500 → 500 → 200`, uses the same event ID and body for each request, prints one
line per attempt and produces optional machine-readable evidence. Only use synthetic payloads.

## GitHub Actions

Add the endpoint as an Actions secret named `HOOKTRIALS_ENDPOINT_URL`; never commit the private
token. Copy `examples/github-action.yml` into your own workflow or call the published action:

```yaml
- uses: IKER-36/hooktrials@v0.34.0
  with:
    config: examples/payment-webhook.trial.yml
    endpoint: ${{ secrets.HOOKTRIALS_ENDPOINT_URL }}
    junit: hooktrials-junit.xml
```

The action's `passed` and `summary` outputs can gate later jobs. Upload JSON or JUnit files with the
standard artifact/test-report action used by your organization.

## Trial file

- `attempts[].expect`: exact HTTP status required for that attempt.
- `attempts[].waitMs`: optional pause after the attempt, capped at 30 seconds.
- `payload`: string or YAML value serialized once and reused for all attempts.
- `headers`: optional string headers. `x-event-id` is generated automatically.
- `eventId`: optional stable correlation key. Omit it to generate a unique CI run ID.
- `timeoutMs`: per-request timeout between 1 and 60 seconds.
- `endpoint`: optional for disposable local files; the environment variable or action input wins.

The CLI deliberately does not create endpoints or modify dashboard configuration. It only sends
the declared synthetic requests to the URL you provide.

## Scoped CI automation

For pipelines that should run an existing Observe or Protect route and retain evidence, create a
scoped API key in **Resources → API keys**. Use a write key for the synthetic run and a separate read
key for evidence export. The complete command reference and rotation guidance lives in
[API keys and automation](api-keys.md).

## Self-host update CLI

The root `./hooktrials` CLI also manages safe self-hosted upgrades:

```bash
git fetch --tags origin
./hooktrials update --release v0.34.0 --check
./hooktrials update --release v0.34.0
./hooktrials doctor --external
./hooktrials doctor --deep
```

`--check` validates that the tag exists and reports whether it differs from the current checkout
without replacing containers or changing volumes. A real update requires a clean checkout, creates
mode-`0600` PostgreSQL and runtime backups, switches to the selected tag, rebuilds the containers,
waits for migrations and health checks, and records the result in `.hooktrials/update-state`.

If the application fails during the update, the previous source checkout is restored automatically.
After a successful update, `./hooktrials rollback --yes` restores that recorded checkout and
restarts the stack. Rollback never silently reverses database migrations; use the printed backup and
the restore procedure when schema recovery is required.

`doctor --deep` is a read-only preflight for an operator handoff. It checks Compose configuration,
service state, the API health and setup metadata endpoints, available disk space and whether a local
PostgreSQL backup exists. It never prints runtime secrets or payload data.
