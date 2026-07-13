# Three-minute competition demonstration

Use a dedicated synthetic Cloud account. Open the dashboard before recording and keep Operations in
a second tab. Do not show secrets, private runtime files, VPS addresses or administration consoles.

## 0:00-0:25 — the problem

“A request bin proves one request arrived. HookTrials proves how an integration behaves across
failure, retries, monitoring and recovery.” Show the unified Overview and the Test, Observe, Protect,
Monitor and Recover language.

## 0:25-1:35 — one complete control loop

Open **Demo Lab** and select **Run full demo**. Explain each state as it turns green:

- Trial groups the provider-style `500 -> 500 -> 200` sequence.
- Observe exposes the real downstream failure synchronously.
- Protect returns `202`, persists first and retries without losing the event.
- Monitor opens and recovers an incident from active checks.
- Operations reconciles incidents, protected recovery and dead letters.

Pause on **Journey verified** and the four operational counters.

## 1:35-2:10 — evidence, not animation

Open **Inspect timelines** and show one correlated event with attempts and destination deliveries.
Open **Monitor** to show check history and recovered incident evidence. Open **Operations** to show
zero unresolved dead letters and the protected recovery count.

## 2:10-2:35 — developer workflow

Show `examples/payment-webhook.trial.yml` and a terminal result with three PASS lines. Explain that
the same exact trial runs from the CLI or bundled GitHub Action and fails CI if a status differs.

## 2:35-3:00 — credible deployment

“The complete product is AGPL-3.0, self-hosts with one command and supports local, reverse-proxy or
automatic-HTTPS domain modes. The managed version runs on CubePath with isolated ingestion,
PostgreSQL, Redis/BullMQ workers, append-only backups, restore testing and a public health watch.”

Finish on the landing statement: **Test failure. Protect delivery. Prove recovery.**

After recording, use **Clean only this demo run** and confirm the scoped-cleanup message.
