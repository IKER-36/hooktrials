# Configuration

`./hooktrials up` generates `.hooktrials/runtime.env` once. The ignored file contains private
runtime values and must persist across updates. Prefer `./hooktrials configure` over editing it.

## Access configuration

```bash
./hooktrials configure

# Equivalent non-interactive examples
./hooktrials configure local 3000
./hooktrials configure proxy https://trials.example.com 3000
./hooktrials configure domain trials.example.com operator@example.com
```

Configuration does not rotate passwords or encryption keys. Run `./hooktrials up` to apply it and
`./hooktrials doctor --external` to verify a public mode. See the complete [external access
guide](external-access.md) before accepting real webhooks.

| Name                    | Default                 | Purpose                                           |
| ----------------------- | ----------------------- | ------------------------------------------------- |
| `HOOKTRIALS_MODE`       | `local`                 | `local`, `proxy` or `domain`                      |
| `HOOKTRIALS_PORT`       | `3000`                  | Local/proxy loopback port                         |
| `HOOKTRIALS_ORIGIN`     | `http://localhost:3000` | Browser and generated ingestion origin            |
| `HOOKTRIALS_DOMAIN`     | empty                   | Hostname used by direct-domain Caddy              |
| `ACME_EMAIL`            | empty                   | Certificate account email                         |
| `COOKIE_SECURE`         | `false`                 | Require HTTPS for session cookie                  |
| `EVENT_RETENTION_HOURS` | `72`                    | Payload retention                                 |
| `MAX_BODY_BYTES`        | `524288`                | Maximum webhook body                              |
| `ENDPOINTS_LIMIT`       | `0`                     | Per-user endpoints; zero means unlimited          |
| `MONITORS_LIMIT`        | `0`                     | Per-user monitors; zero means unlimited           |
| `DAILY_EVENTS_LIMIT`    | `0`                     | Daily attempts; zero means unlimited              |
| `TRUST_PROXY_HOPS`      | `1`                     | Reverse-proxy hops used for client IP/rate limits |

Direct edits are an advanced operation. Stop services first and never change generated secret
values unless intentionally rotating them.

## Registration policy

- `open`: anyone may create accounts.
- `first-user`: only the initial owner can register; self-hosted default.
- `closed`: no registration.

## Secrets and backups

Generated values include PostgreSQL and Redis passwords, the session secret and the payload
encryption key. Never commit them. Losing `PAYLOAD_ENCRYPTION_KEY` makes retained payloads
unreadable. The update command snapshots `.hooktrials/runtime.env` with mode `0600` before changing
the checkout; still copy the runtime snapshot and database backup to an encrypted off-host location.
