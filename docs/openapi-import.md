# OpenAPI import

OpenAPI import turns a documented API into a set of monitored integrations. It is useful when a
service has many health or read endpoints and creating every monitor manually would be repetitive.

## Start an import

1. Open **Documentation → Import OpenAPI** or use the import action in Monitoring.
2. Upload an OpenAPI 3.0/3.1 JSON or YAML file, paste the document, or provide a public URL.
3. Check the concrete server URL. It can override the first `servers` entry and resolve server
   variables to the host you actually want to monitor.
4. Review the operation list and select the endpoints that should become monitors.
5. Choose **Test** or **Staging**, select a check frequency and create the monitors.
6. Open **Monitoring** to review targets, run a first check and adjust the response contract.

The importer creates at most 20 monitors per action. Each monitor uses the operation's first
successful response range when it is present; otherwise it starts with the normal `200–299` range.
You can edit the expected status, text, JSON path, headers and failure threshold afterwards.

## Safe boundaries

- The document is parsed in the browser. A URL source must allow CORS; HookTrials does not proxy
  an arbitrary specification through the API.
- Only operation names, paths, summaries, methods and successful status codes are used.
- Authentication schemes, security headers, request bodies, examples and secrets are never copied.
- OpenAPI path templates such as `/users/{id}` are shown but skipped until a concrete value can be
  supplied. This prevents a monitor from probing an unintended resource.
- `GET` and `HEAD` operations are selected by default. `POST` operations are hidden from the
  initial selection and require an explicit opt-in because an empty request can still have side
  effects on a real service.
- `PUT`, `PATCH`, `DELETE` and other methods are shown as unsupported monitor operations.
- Imports are intentionally limited to **Test** and **Staging**. Review each generated monitor
  before using a production target.

If an imported target is blocked, private, or does not respond, the monitor is still created only
when the API accepts it; the result list reports each success and failure separately. Correct the
target or network policy in Monitoring rather than retrying the entire import blindly.

## Recommended workflow

Use a dedicated health or read-only server in the specification, import a small selection first,
and run the checks before expanding the set. Keep authentication headers write-only and configure
them manually in the monitor editor. For a webhook provider, use [Integrations](live-webhook-hub.md)
instead: OpenAPI import validates service availability, while Integrations protects and forwards
real inbound delivery.
