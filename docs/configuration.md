# Configuration

`./hooktrials up` generates private runtime configuration automatically. File lives at
`.hooktrials/runtime.env`, is ignored by Git and must remain persistent across updates.

## Operator options before first start

```bash
HOOKTRIALS_PORT=8080 \
HOOKTRIALS_ORIGIN=https://hooks.example.com \
COOKIE_SECURE=true \
./hooktrials up
```

| Name                    | Default                 | Purpose                                  |
| ----------------------- | ----------------------- | ---------------------------------------- |
| `HOOKTRIALS_BIND`       | `0.0.0.0`               | Host bind address                        |
| `HOOKTRIALS_PORT`       | `3000`                  | Host HTTP port                           |
| `HOOKTRIALS_ORIGIN`     | `http://localhost:3000` | Browser and generated ingestion origin   |
| `COOKIE_SECURE`         | `false`                 | Require HTTPS for session cookie         |
| `EVENT_RETENTION_HOURS` | `72`                    | Payload retention                        |
| `MAX_BODY_BYTES`        | `524288`                | Maximum webhook body                     |
| `ENDPOINTS_LIMIT`       | `0`                     | Per-user endpoints; zero means unlimited |
| `DAILY_EVENTS_LIMIT`    | `0`                     | Daily attempts; zero means unlimited     |

## Registration policy

- `open`: anyone may create accounts.
- `first-user`: only initial owner can register; self-hosted default.
- `closed`: no registration.

## Secrets

Generated values include PostgreSQL and Redis passwords, session secret and payload encryption key.
Do not commit them. Losing `PAYLOAD_ENCRYPTION_KEY` makes retained payloads unreadable. Back up runtime
file separately from database and encrypt both copies.
