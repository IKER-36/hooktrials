import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';

const steps = [
  {
    eyebrow: '01 / OVERVIEW',
    title: 'See reliability at a glance',
    body: 'The Control Center combines active routes, monitor health, incidents, dead letters and recent recoveries. Start here when you need to know what needs attention.',
    path: '/app',
    target: 'overview',
    selector: '.ht-control-center',
    note: 'Production Readiness turns configuration and recorded evidence into one transparent checklist.',
  },
  {
    eyebrow: '02 / ENDPOINTS',
    title: 'Create a safe webhook route',
    body: 'Every route starts in Trial. Copy its private ingestion URL, choose a deterministic scenario and only move to Observe or Protect when a destination is ready.',
    path: '/app/endpoints',
    target: 'endpoints',
    selector: '.ht-endpoints-grid',
    note: 'Trial returns controlled failures. Observe forwards once. Protect persists first and retries safely.',
  },
  {
    eyebrow: '03 / SCENARIOS',
    title: 'Design the failure you need to prove',
    body: 'Use built-in recipes or create an exact sequence of status codes, delays, headers and response bodies. Repeating the same test produces the same evidence.',
    path: '/app/scenarios',
    target: 'scenarios',
    selector: '.ht-studio-grid',
    note: 'The sender performs the retry; HookTrials correlates every attempt using the same event ID.',
  },
  {
    eyebrow: '04 / MONITOR',
    title: 'Measure APIs and destinations',
    body: 'Active checks track availability, latency and contracts. Degradation opens an incident; recovery closes it and preserves the measured history.',
    path: '/app/monitor',
    target: 'monitor',
    selector: '.ht-monitor-grid',
    note: 'Every score deduction links to concrete check or incident evidence—never a hidden grade.',
  },
  {
    eyebrow: '05 / OPERATIONS',
    title: 'Recover from one queue',
    body: 'Triage incidents, retry or replay dead letters and audit outgoing notifications without searching across separate tools.',
    path: '/app/operations',
    target: 'operations',
    selector: '.ht-operation-summary',
    note: 'Manual recovery always requires confirmation and records who requested it.',
  },
  {
    eyebrow: '06 / DEMO LAB',
    title: 'Explore the whole product safely',
    body: 'Demo Lab creates isolated synthetic resources across Trial, Observe, Protect, Monitor, Operations and Evidence. It never replaces your real resources.',
    path: '/app/demo',
    target: 'demo',
    selector: '.ht-demo-grid',
    note: 'Use it to learn, then reset only its user-owned workspace when you are finished.',
  },
  {
    eyebrow: '07 / DOCS',
    title: 'Keep the operating guide beside the product',
    body: 'Docs explains what each module does, when to use it, the exact workflow and what to check when a result is unexpected.',
    path: '/app/docs',
    target: 'docs',
    selector: '.ht-docs-layout',
    note: 'You can reopen this tour or Docs at any time from the sidebar.',
  },
] as const;

export function OnboardingTour({ onFinish }: { onFinish(): Promise<void> }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const current = steps[index] ?? steps[0]!;

  useEffect(() => {
    navigate(current.path);
    let active: HTMLElement | null = null;
    let attempts = 0;
    const findTarget = window.setInterval(() => {
      active =
        document.querySelector<HTMLElement>(current.selector) ??
        document.querySelector<HTMLElement>(`[data-tour-section="${current.target}"]`);
      if (active || attempts > 20) {
        window.clearInterval(findTarget);
        active?.setAttribute('data-tour-active', 'true');
        active?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      attempts += 1;
    }, 75);
    panelRef.current?.focus();
    return () => {
      window.clearInterval(findTarget);
      active?.removeAttribute('data-tour-active');
      document
        .querySelectorAll<HTMLElement>('[data-tour-active]')
        .forEach((element) => element.removeAttribute('data-tour-active'));
    };
  }, [current.path, current.selector, current.target, navigate]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') void finish();
      if (event.key === 'ArrowRight' && index < steps.length - 1) setIndex((value) => value + 1);
      if (event.key === 'ArrowLeft' && index > 0) setIndex((value) => value - 1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  async function finish() {
    setBusy(true);
    try {
      await onFinish();
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <>
      <div className="ht-tour-layer" aria-hidden="true">
        <div className="ht-tour-scrim" />
      </div>
      <section
        ref={panelRef}
        className="ht-tour-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="ht-tour-title"
        aria-describedby="ht-tour-body"
        tabIndex={-1}
      >
        <header>
          <span>{current.eyebrow}</span>
          <button
            type="button"
            className="ht-tour-close"
            onClick={() => void finish()}
            disabled={busy}
            aria-label="Close product tour"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="ht-tour-context" aria-hidden="true">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <i />
          <span>{String(steps.length).padStart(2, '0')}</span>
        </div>
        <h2 id="ht-tour-title">{current.title}</h2>
        <p id="ht-tour-body">{current.body}</p>
        <aside>{current.note}</aside>
        <footer>
          <div>
            <strong>
              {index + 1} of {steps.length}
            </strong>
            <div className="ht-tour-progress" aria-hidden="true">
              {steps.map((step, stepIndex) => (
                <i key={step.eyebrow} className={stepIndex <= index ? 'active' : ''} />
              ))}
            </div>
          </div>
          <nav aria-label="Tour controls">
            <button
              type="button"
              onClick={() => setIndex((value) => value - 1)}
              disabled={index === 0}
              aria-label="Previous step"
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            {index < steps.length - 1 ? (
              <button
                type="button"
                className="primary"
                onClick={() => setIndex((value) => value + 1)}
              >
                Next <ChevronRight aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => void finish()}
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Finish'}
              </button>
            )}
          </nav>
        </footer>
        <Link className="ht-tour-docs" to="/app/docs" onClick={() => void finish()}>
          <BookOpen aria-hidden="true" /> Open the full guide
        </Link>
      </section>
    </>,
    document.body,
  );
}
