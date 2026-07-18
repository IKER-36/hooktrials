# Public status pages

Status pages publish a customizable, read-only service view for customers or teammates. One page
can combine any selected HTTP or ICMP monitors owned by the signed-in account.

## Create a page

1. Open **Monitoring** and find **Status pages**.
2. Select **New status page**.
3. Set an internal name, public headline, optional description and accent color.
4. Choose the monitors to publish and keep the page enabled.
5. Create the page and copy its opaque public URL.

Use **Edit** to change presentation, visibility or monitor selection. **Rotate** immediately
invalidates the previous URL and generates a new one. **Delete** permanently removes the page.
Each account can create up to 10 pages with up to 25 monitors per page.

## Public contents

The page refreshes every 30 seconds and shows an aggregate state plus, for every selected monitor:

- integration name, type, environment and redacted hostname;
- current health state;
- 24-hour availability, average latency, p95 and check count;
- up to 50 recent outcomes;
- recent open and recovered incident summaries.

English and Spanish are available directly on the public page. The selection persists in the
browser and does not require an account.

## Privacy and revocation

The response never contains authentication headers, query strings, response bodies, complete
encrypted target URLs, user identity or account data. The URL token is high entropy; its lookup
value is stored as SHA-256 and its recoverable copy is encrypted at rest for the owner dashboard.

Pages do not expire automatically. Treat the URL as shareable information, disable the page when it
should temporarily disappear, and rotate it whenever its audience changes. Legacy single-monitor
status links created by earlier releases continue to work and can still be revoked from the monitor.
