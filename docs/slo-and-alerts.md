# SLOs, error budgets and alerts

HookTrials can turn every HTTP, HTTPS or ICMP monitor into an explicit reliability objective. The objective is evaluated from recorded checks, so the result is explainable and can be exported with the rest of the monitoring evidence.

## Configure an objective

Open **Monitoring**, create or edit a monitor, and set:

- **Availability objective**: the expected percentage of healthy checks, from 90% to 100% (for example, `99.90`).
- **Objective window**: the rolling period used for the calculation: 24 hours, 7, 14 or 30 days.

The target and window are saved with the monitor. Existing monitors receive a 99.90% target and a seven-day window when upgrading, so the update does not change their checks or credentials.

## Read the budget

The **SLO & reliability** page shows the objective alongside the evidence:

- **Healthy** means the monitor still has more than 20% of its available error budget.
- **At risk** means 20% or less remains.
- **Breached** means the recorded failures have exhausted the budget.
- **Collecting evidence** means fewer than five checks are available; HookTrials does not raise an SLO alert from an unproven baseline.

The budget is expressed in check outcomes, not guessed uptime. A failed HTTP contract, an unreachable host and an unsuccessful ICMP probe all consume budget. Latency and incident counts remain visible beside the budget so an operator can understand the cause.

## Alerts

Configure a Discord or generic HTTPS alert channel from **Incidents & recovery → Configure alerts**. When a monitor exhausts its budget, HookTrials opens a reliability incident with the monitor, target, window, check count and failures as evidence. The existing alert channel receives the same opened/recovered events as availability incidents. No URLs, headers or response bodies are included in the alert payload.

SLO incidents are independent from an endpoint being temporarily down. This keeps a short outage visible while preserving the longer rolling objective. When the rolling window recovers, HookTrials closes the SLO incident and sends the recovery notification.

## Self-hosted operation

The SLO calculation runs in the worker and stores only the monitor objective and check evidence. The migration is applied automatically by the self-hosted Compose deployment. Keep the worker running so checks and budget transitions continue to be evaluated.
