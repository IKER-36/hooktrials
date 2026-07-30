# SLO and reliability views

The **SLO & reliability** page turns monitor evidence into a small, explainable service view. It
does not invent uptime: a monitor with no recorded checks is shown as having no measurement.

Choose a 24-hour, 7-day or 30-day window. HookTrials reports:

- availability from healthy monitor checks;
- total and healthy checks;
- average and p95 latency when latency evidence exists;
- incidents opened in the selected window;
- the same measurements for each HTTP/HTTPS or ICMP monitor.

The default objective is 99.90% availability. It is a comparison target, not a contractual SLA.
The page makes the underlying window and check count visible so operators can decide whether the
sample is meaningful before sharing it.

## API

Authenticated clients can read the summary with:

```text
GET /v1/reliability/summary?windowDays=7&target=99.9
```

`windowDays` accepts values up to 30. `target` is optional and ranges from 90 to 100. The response
is derived from the requesting account's monitors only.
