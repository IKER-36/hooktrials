# Three-minute competition demonstration

Use a dedicated synthetic Cloud account. Open the dashboard before recording and keep Operations in
a second tab. Do not show secrets, private runtime files, VPS addresses or administration consoles.

## 0:00-0:25 — the problem

“A request bin proves one request arrived. HookTrials proves how an integration behaves across
failure, retries, monitoring and recovery.” Show the unified Overview and the Test, Observe, Protect,
Monitor and Recover language.

## 0:25-1:35 — one complete control loop

Open **Demo Lab** and select **Run full demo**. Explain each state as it turns green:

- Scenario Studio receives a custom cascading-outage recipe.
- Trial groups the provider-style `500 -> 503 -> 429 -> 200` sequence.
- Observe exposes the real downstream failure synchronously.
- Protect returns `202`, persists first and retries without losing the event.
- Monitor fills external API, internal API, HTTP route and webhook-destination rows across healthy,
  degraded, down and recovered states.
- Operations reconciles open/recovered incidents, protected recovery, safe alert audit and dead
  letters.
- Evidence creates a redacted 24-hour share link for the recovered Trial.

Pause on **Journey verified** and the six operational counters.

## 1:35-2:10 — evidence, not animation

Open **Inspect timelines** and show one correlated event with attempts and destination deliveries.
Open **Scenario Studio** to show the generated recipe. Open **Monitor** to show all four resource
types and health states. Open **Operations** to show the open/recovered incidents, alert audit, zero
unresolved dead letters and protected recovery count. Finish on the redacted evidence link.

## 2:10-2:35 — developer workflow

Show `examples/payment-webhook.trial.yml` and a terminal result with three PASS lines. Explain that
the same exact trial runs from the CLI or bundled GitHub Action and fails CI if a status differs.

## 2:35-3:00 — credible deployment

“The complete product is AGPL-3.0, self-hosts with one command and supports local, reverse-proxy or
automatic-HTTPS domain modes. The managed version runs on CubePath with isolated ingestion,
PostgreSQL, Redis/BullMQ workers, append-only backups, restore testing and a public health watch.”

Finish on the landing statement: **Test failure. Protect delivery. Prove recovery.**

After recording, use **Clean only this demo run** and confirm the scoped-cleanup message.
