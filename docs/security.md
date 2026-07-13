# Security

HookTrials accepts untrusted Internet traffic and can store sensitive webhook payloads. Security is
a product requirement, not a deployment option.

## Trust boundaries

- Caddy is the only public network entry point.
- The ingestor handles arbitrary external content.
- The API handles authenticated user operations.
- PostgreSQL and Redis are reachable only from the internal Docker network.
- The browser never receives database or encryption credentials.

## Current controls

- Bounded request bodies.
- Rate limits on API and ingestion traffic.
- Random endpoint tokens stored as hashes.
- Recoverable endpoint URLs encrypted at rest; lookup continues to use the non-reversible hash.
- Session tokens stored as hashes.
- Argon2id password hashes.
- HttpOnly, Secure and SameSite session cookies in production.
- AES-256-GCM payload encryption at rest.
- Log redaction for credentials, cookies and common secret fields.
- Short default retention.
- Automatic expired-event and expired-session cleanup.
- Containers run without published database or Redis ports.
- Non-root application runtime image.
- One outbound network policy for monitors, Observe/Protect delivery and alert webhooks.
- DNS and every resolved IPv4/IPv6 address validated before connecting.
- Loopback, private, link-local, metadata and special-use targets blocked by default.
- Redirects disabled, DNS lookup pinned, response bytes bounded and request phases timed out.
- Self-host private access requires explicit CIDR allowlists; Cloud always blocks private targets.
- Destination headers, monitor headers and signature secrets encrypted and write-only.
- Manual retry/replay requires confirmation and stores user/source audit metadata.
- Public evidence uses a hashed expiring token and excludes bodies, headers, credentials and URLs.

## Rules for rendering captured content

- Never execute received JavaScript.
- Never inject received HTML into the DOM.
- Display untrusted text through escaped React nodes.
- Do not render remote SVG as trusted markup.
- Preserve raw bytes for signature verification without treating them as executable content.

## Outbound request boundary

Webhook destinations, monitor targets and alert channels are untrusted outbound inputs. All use the
same network-policy package. Validation and connection use the same pinned DNS result, redirects are
not followed and response bodies are never retained by Monitor. An operator should still isolate the
containers from sensitive networks and grant only the minimum private CIDRs required by self-hosted
integrations.

## Reporting

Security reports should follow the process that will be published in SECURITY.md before the first
public release. Do not post exploitable production details in public issues.
