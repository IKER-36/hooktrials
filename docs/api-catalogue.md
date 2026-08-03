# API catalogue

Every HookTrials installation exposes a redacted OpenAPI 3.1 document at:

```text
https://your-api-origin.example/openapi.json
```

Cloud uses `https://api.hooktrials.com/openapi.json`. Self-hosted installations use the API origin
chosen during setup. The document is safe to publish: it describes routes, parameters, response
shapes and authentication scopes, but never contains credentials, payload examples or destination
URLs.

## Discover operations from the CLI

Build the CLI from the release you run and list the published operations:

```bash
pnpm --filter @hooktrials/cli build
pnpm exec hooktrials-api \
  --api-origin "$HOOKTRIALS_API_ORIGIN" \
  --list
```

Export the exact document used by a client generator or an internal review:

```bash
pnpm exec hooktrials-api \
  --api-origin "$HOOKTRIALS_API_ORIGIN" \
  --output hooktrials-openapi.json
```

The command does not send credentials and exits non-zero when the origin is unavailable or returns
an invalid document. `--operation-id <name>` can be used as a small CI contract check after an
installation upgrade.

## Authentication boundaries

- Public system and public-status operations do not require authentication.
- Dashboard routes use the browser session cookie and are intended for interactive use.
- CI operations use scoped `htk_…` bearer keys. `write` can run a synthetic check; `read` can export
  redacted evidence.
- API keys are never included in the catalogue response and should be stored only in the CI secret
  manager.

The automation paths deliberately do not create routes, accept arbitrary destinations or return raw
payloads. Use [API keys and automation](api-keys.md) for the complete CI workflow.

Session-authenticated monitor and evidence inventories accept an optional `scope` query. Use
`product` for normal workspace data, `demo` for isolated Demo Lab resources or omit it to retain the
backwards-compatible `all` behavior.

## From catalogue to monitors

The dashboard also links **Import OpenAPI** from Documentation and Monitoring. It reads a JSON or YAML contract in the
browser, previews monitorable operations and can create up to 20 test or staging monitors at a time.
The import does not copy security schemes, headers, request bodies or secrets. See
[OpenAPI import](openapi-import.md) for the selection and safety rules.
