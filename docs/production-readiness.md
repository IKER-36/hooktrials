# Production readiness

Every managed webhook route has an explainable Production Readiness score in **Overview**. It is a
configuration-and-evidence checklist, not the operational reliability score shown in Monitor.

The score totals 100 points:

| Control                          | Points |
| -------------------------------- | -----: |
| Route active                     |      5 |
| Public HTTPS ingestion reachable |     10 |
| Inbound contract configured      |     15 |
| Provider signature configured    |     15 |
| Destination configured           |     10 |
| Protect mode enabled             |     15 |
| Traffic observed                 |     10 |
| Recovery demonstrated            |     10 |
| Evidence report generated        |      5 |
| No open incident                 |      5 |

Each missing control displays its exact point cost and a concrete next action. Levels are:

- **Starting:** below 55;
- **Developing:** 55–84;
- **Production ready:** 85–100.

Production ready means the HookTrials baseline is proven. It does not certify a provider, backend,
legal requirement or business process. Repeat the recovery trial after material integration
changes, secret rotation or retry-policy changes.
