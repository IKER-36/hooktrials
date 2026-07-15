# Public status pages

An active monitor can publish a read-only status page for customers or teammates.

1. Open **Monitor** and select an API, HTTP route or webhook destination monitor.
2. Under **Public status**, select **Create public status**.
3. Copy the generated opaque link.
4. Use **Rotate public link** to invalidate the previous URL or **Disable** to revoke it.

The page refreshes every 30 seconds and includes:

- integration name, type, environment and monitored hostname;
- current health state;
- 24-hour availability, average latency, p95 and check count;
- up to 50 recent check outcomes;
- recent open and recovered incident summaries.

It never includes authentication headers, query strings, response bodies, encrypted target URL,
user identity or account data. The opaque token is stored only as a SHA-256 hash. Creating another
link rotates the token immediately; disabling removes it.

Public status pages do not expire automatically. Treat the URL as shareable information and disable
it when the audience no longer needs access.
