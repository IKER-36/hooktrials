# External access

Webhook senders running outside your machine cannot reach a `localhost` URL. HookTrials therefore
supports three explicit access modes. Changing mode preserves the database, encryption key and all
generated secrets.

## Choose a mode

| Mode     | Best for                      | Public webhooks | HTTPS owner              |
| -------- | ----------------------------- | --------------- | ------------------------ |
| `local`  | Evaluation on the Docker host | No              | Not required             |
| `proxy`  | Existing Caddy/Nginx/Traefik  | Yes             | Your reverse proxy       |
| `domain` | A VPS dedicated to HookTrials | Yes             | HookTrials Caddy profile |

Run `./hooktrials configure` for the guided prompt, or use one of the commands below. Apply any
change with `./hooktrials up`.

## Local-only mode

```bash
./hooktrials configure local 3000
./hooktrials up
```

HookTrials binds only to `127.0.0.1`. This is the safest default and is intentionally unreachable
from Stripe, GitHub, Shopify and other external providers.

## Existing HTTPS reverse proxy

First configure the exact public origin and the internal loopback port:

```bash
./hooktrials configure proxy https://trials.example.com 3000
./hooktrials up
```

Create the DNS record and forward **every path** from the public hostname to
`http://127.0.0.1:3000`. This includes dashboard pages, `/api/*`, `/i/*` and the event stream. Do
not place authentication middleware in front of `/i/*`; webhook providers cannot complete an
interactive login.

Example Caddy site in an existing host-level Caddy installation:

```caddyfile
trials.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

For Nginx, disable response buffering for `/api/v1/endpoints/*/stream` so live events are delivered
without delay. Terminate TLS at the proxy and keep the HookTrials port closed to the public network.

## Direct public domain with automatic HTTPS

Use this mode on a VPS where ports 80 and 443 are free:

1. Create an `A` record for the hostname pointing to the VPS IPv4 address. Add `AAAA` only when
   IPv6 is correctly routed.
2. Allow inbound TCP 80 and TCP/UDP 443 in the provider firewall and host firewall.
3. Configure and start HookTrials:

```bash
./hooktrials configure domain trials.example.com operator@example.com
./hooktrials up
./hooktrials doctor --external
```

The domain profile exposes only Caddy. PostgreSQL, Redis, API and worker ports stay on private
Docker networks. Caddy obtains and renews the certificate and stores it in persistent Docker
volumes. The configured email receives certificate-account notices.

When using Cloudflare DNS, start with the record set to **DNS only** until the origin certificate is
working. You may enable the proxy afterwards; use SSL/TLS mode `Full (strict)` and never `Flexible`.

## Verification and troubleshooting

```bash
./hooktrials status
./hooktrials doctor
./hooktrials doctor --external
./hooktrials logs gateway
```

`doctor --external` calls the public HTTPS health endpoint. Common failures:

- **DNS does not resolve:** correct the `A`/`AAAA` record and wait for propagation.
- **Timeout:** open ports 80/443, check NAT, or use a tunnel when behind carrier-grade NAT.
- **Certificate failure:** make sure the domain points to this server and no other service owns
  ports 80/443.
- **Dashboard works but webhook does not:** ensure the proxy forwards `/i/*` without login or access
  policy challenges.
- **Session immediately expires:** the configured origin must exactly match the browser HTTPS
  origin.

The dashboard labels local endpoints as `LOCAL ONLY`. A public configuration removes that warning
after services restart.

## Cloudflare Tunnel and development tunnels

Cloudflare Tunnel is useful behind carrier-grade NAT because the connector opens outbound
connections. Create a named tunnel in Cloudflare, publish the chosen hostname to
`http://127.0.0.1:3000`, then use proxy mode with that hostname. Keep the tunnel token outside Git.

Temporary quick tunnels are suitable for demonstrations only. Their hostname can change, making
saved endpoint URLs invalid. Do not use them for durable integrations.

## Security checklist

- Use synthetic webhook payloads whenever possible.
- Never expose PostgreSQL (`5432`) or Redis (`6379`).
- Keep `.hooktrials/runtime.env` mode `0600` and back it up encrypted.
- Keep `/i/*` public, but protect the dashboard through HookTrials login.
- Run `./hooktrials update` regularly and verify external access afterwards.
- If the public hostname changes, reconfigure and restart before distributing new endpoint URLs.

For how automatic certificates work, see [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https).
For outbound tunnels, see [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/).
