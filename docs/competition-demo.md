# Three-minute competition demonstration

Use a dedicated synthetic Cloud account. Open the dashboard before recording and keep Operations in
a second tab. Do not show secrets, private runtime files, VPS addresses or administration consoles.

## 0:00-0:25 — the problem

“A request bin proves one request arrived. HookTrials proves how an integration behaves across
failure, retries, monitoring and recovery.” Start in **Product → Webhook Hub** and show the explicit
provider → HookTrials → backend flow. Explain that Product contains live work while Lab contains
safe deterministic experiments.

## 0:25-1:35 — one complete control loop

Open **Lab → Guided Demo** and select **Run full demo**. Explain each state as it turns green:

- Failure scenarios receives a custom cascading-outage recipe.
- Trial groups the provider-style `500 -> 503 -> 429 -> 200` sequence.
- Observe exposes the real downstream failure synchronously.
- Protect returns `202`, persists first and retries without losing the event.
- Monitoring fills external API, internal API, HTTP route and webhook-destination rows across healthy,
  degraded, down and recovered states.
- Recovery queue receives a separate protected event after it exhausts all three delivery attempts.
- Operations reconciles open/recovered incidents, protected recovery, safe alert audit and the
  actionable dead letter.
- Evidence creates a redacted 24-hour share link for the signed Protect recovery.

Pause on **Journey verified** and the six operational counters. Then open Webhook Hub and show the
three labelled demo connections without implying that they are production traffic.

## 1:35-2:15 — evidence, not animation

Open **Inspect timelines** and pause on **Reliability Replay**: diagnosis, impact, four causal stages
and evidence-based runbook. Expand the first-to-last attempt comparison. Return to **Control Center**
and show the Production Readiness checklist with its highest-impact next action. Open **Monitoring** to show all
four demo resource types plus a live ICMP target, create a customizable status page with two
selected monitors and then show Operations with one
actionable dead letter. Finish on the redacted evidence link.

## 2:15-2:38 — developer workflow

Show `examples/payment-webhook.trial.yml` and a terminal result with three PASS lines. Explain that
the same exact trial runs from the CLI or bundled GitHub Action and fails CI if a status differs.

## 2:38-3:00 — credible deployment

“The complete product is AGPL-3.0, self-hosts with one command and supports local, reverse-proxy or
automatic-HTTPS domain modes. The managed version runs on CubePath with isolated ingestion,
PostgreSQL, Redis/BullMQ workers, append-only backups, restore testing and a public health watch.”

Finish on the landing statement: **See every webhook. Never lose the delivery.**

Use **Clean only this demo run** only in a disposable rehearsal account. Preserve the dedicated jury
account so reviewers can inspect the populated workspace. During rehearsal, reload once before
cleanup to prove that HookTrials recovers the private run safely.
