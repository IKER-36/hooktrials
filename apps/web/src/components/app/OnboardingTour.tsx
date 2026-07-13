import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const steps = [
  {
    eyebrow: '01 / CONTROL CENTER',
    title: 'One place for integration reliability',
    body: 'HookTrials combines controlled failure trials, safe webhook operation and active API monitoring. Start here to see health, incidents and recoveries.',
    path: '/app',
    note: 'The overview answers what is failing, why and whether traffic was recovered.',
  },
  {
    eyebrow: '02 / ROUTES',
    title: 'Choose how each webhook behaves',
    body: 'Trial simulates failures. Observe forwards synchronously and records the journey. Protect persists first, retries downstream and dead-letters exhausted deliveries.',
    path: '/app/endpoints',
    note: 'New routes start safely in Trial. Production changes require explicit confirmation.',
  },
  {
    eyebrow: '03 / TRIALS',
    title: 'Break integrations before production does',
    body: 'Use built-in scenarios or compose deterministic status, latency, headers and response bodies. Your sender performs retries; HookTrials records every attempt.',
    path: '/app/scenarios',
    note: 'The simulator lets you demonstrate a complete retry flow without another provider.',
  },
  {
    eyebrow: '04 / MONITOR',
    title: 'Monitor APIs, routes and destinations',
    body: 'Create active checks for external APIs, internal allowlisted services and HTTP routes. Availability, latency, contracts and incidents produce an explainable score.',
    path: '/app/monitor',
    note: 'Outgoing alert webhooks report incident openings and recoveries without exposing secrets.',
  },
  {
    eyebrow: '05 / EVIDENCE',
    title: 'Follow the full delivery journey',
    body: 'Open an event to separate provider receipt, signature and contract validation from downstream delivery, retry and recovery. Share a redacted 24-hour evidence link when needed.',
    path: '/app',
    note: 'Payloads, credentials, sensitive headers and destination URLs never enter public evidence.',
  },
  {
    eyebrow: '06 / READY',
    title: 'Run the guided demonstration',
    body: 'Create a template endpoint, send the included provider simulation, then promote the route to Observe or Protect when you are ready to connect a destination.',
    path: '/app/endpoints',
    note: 'You can restart this tour from the sidebar. Full guides live in the public docs folder.',
  },
] as const;

export function OnboardingTour({ onFinish }: { onFinish(): Promise<void> }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = steps[index] ?? steps[0]!;

  useEffect(() => {
    navigate(current.path);
  }, [current.path, navigate]);

  async function finish() {
    setBusy(true);
    try {
      await onFinish();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ht-tour-backdrop" role="presentation">
      <section className="ht-tour" role="dialog" aria-modal="true" aria-labelledby="ht-tour-title">
        <header>
          <span>{current.eyebrow}</span>
          <button type="button" onClick={() => void finish()} disabled={busy}>
            Skip tour
          </button>
        </header>
        <div className="ht-tour-visual" aria-hidden="true">
          <span>TRIAL</span>
          <i /> <span>CONTROL</span>
          <i /> <span>MONITOR</span>
        </div>
        <h2 id="ht-tour-title">{current.title}</h2>
        <p>{current.body}</p>
        <aside>{current.note}</aside>
        <footer>
          <div className="ht-tour-progress" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((step, stepIndex) => (
              <i key={step.eyebrow} className={stepIndex <= index ? 'active' : ''} />
            ))}
          </div>
          <div>
            {index > 0 ? (
              <button type="button" onClick={() => setIndex((value) => value - 1)}>
                Back
              </button>
            ) : null}
            {index < steps.length - 1 ? (
              <button
                type="button"
                className="primary"
                onClick={() => setIndex((value) => value + 1)}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => void finish()}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Start using HookTrials'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
