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

## Rules for rendering captured content

- Never execute received JavaScript.
- Never inject received HTML into the DOM.
- Display untrusted text through escaped React nodes.
- Do not render remote SVG as trusted markup.
- Preserve raw bytes for signature verification without treating them as executable content.

## Deferred high-risk feature

Arbitrary webhook forwarding is intentionally excluded from the foundation. Before it is added, it
requires comprehensive SSRF defenses, repeated DNS validation, private-address blocking, redirect
limits, response-size limits and strict timeouts.

## Reporting

Security reports should follow the process that will be published in SECURITY.md before the first
public release. Do not post exploitable production details in public issues.
