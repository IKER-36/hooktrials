import { useMemo, useState } from 'react';
import type { Endpoint, Scenario } from '../../lib/types';
import { StatusChip } from '../ui/StatusChip';

interface GuidedDemoProps {
  endpoint: Endpoint;
  scenario: Scenario | null;
  onComplete(): Promise<void>;
}

interface DemoState {
  running: boolean;
  completed: number;
  eventId: string | null;
  error: string;
}

const initialState: DemoState = { running: false, completed: 0, eventId: null, error: '' };

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function GuidedDemo({ endpoint, scenario, onComplete }: GuidedDemoProps) {
  const [state, setState] = useState<DemoState>(initialState);
  const steps = scenario?.definition.steps ?? [];
  const total = Math.max(steps.length, 1);
  const examplePayload = useMemo(
    () =>
      JSON.stringify(
        {
          id: state.eventId ?? 'demo-retry-001',
          event: 'invoice.payment_failed',
          source: 'hooktrials-guided-demo',
          customer: { id: 'cus_demo_42', plan: 'pro' },
        },
        null,
        2,
      ),
    [state.eventId],
  );

  async function runDemo() {
    if (!endpoint.ingestUrl || !endpoint.active || state.running) return;
    const eventId = `demo-${Date.now()}`;
    const body = JSON.stringify({
      id: eventId,
      event: 'invoice.payment_failed',
      source: 'hooktrials-guided-demo',
      customer: { id: 'cus_demo_42', plan: 'pro' },
    });
    setState({ running: true, completed: 0, eventId, error: '' });

    try {
      const targetOrigin = new URL(endpoint.ingestUrl).origin;
      const crossOrigin = targetOrigin !== window.location.origin;
      for (let index = 0; index < total; index += 1) {
        await fetch(endpoint.ingestUrl, {
          method: 'POST',
          body,
          cache: 'no-store',
          credentials: 'omit',
          mode: crossOrigin ? 'no-cors' : 'same-origin',
        });
        setState((current) => ({ ...current, completed: index + 1 }));
        if (index < total - 1) await wait(350);
      }
      await onComplete();
      setState((current) => ({ ...current, running: false }));
    } catch {
      setState((current) => ({
        ...current,
        running: false,
        error:
          'The demo delivery could not reach this endpoint. Check that it is publicly reachable.',
      }));
    }
  }

  return (
    <section className="ht-guided-demo" aria-labelledby="guided-demo-title">
      <div className="ht-guided-copy">
        <p className="ht-kicker">Guided demonstration</p>
        <h2 id="guided-demo-title">See the complete retry cycle</h2>
        <p>
          HookTrials acts as the webhook receiver. The demo runner behaves like a provider: it sends
          the same event again after every failure, allowing HookTrials to group all attempts into
          one timeline.
        </p>
        <ol>
          <li>A synthetic event is delivered to your private URL.</li>
          <li>The selected scenario decides each HTTP response.</li>
          <li>Every retry keeps the same event ID and becomes another attempt.</li>
          <li>Open the resulting timeline to inspect payload, headers, delays and score.</li>
        </ol>
      </div>

      <div className="ht-guided-action">
        <span className="ht-guided-label">Expected responses</span>
        <div className="ht-guided-sequence">
          {(steps.length > 0 ? steps : [{ statusCode: 200 }]).map((step, index) => (
            <span key={index}>
              {index > 0 ? <i aria-hidden="true">→</i> : null}
              <StatusChip code={step.statusCode} />
            </span>
          ))}
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => void runDemo()}
          disabled={state.running || !endpoint.active || !endpoint.ingestUrl}
        >
          {state.running
            ? `Sending attempt ${Math.min(state.completed + 1, total)}/${total}…`
            : `Run ${total}-attempt demo`}
        </button>
        {!endpoint.active ? <small>Resume the endpoint before running the demo.</small> : null}
        {state.error ? <p className="ht-form-error">{state.error}</p> : null}
        {!state.running && state.completed === total ? (
          <p className="ht-demo-success" role="status">
            Demo complete. Event <code>{state.eventId}</code> is now in the timeline below.
          </p>
        ) : null}
        <details className="ht-demo-payload">
          <summary>Payload used by the demo</summary>
          <pre>{examplePayload}</pre>
        </details>
      </div>
    </section>
  );
}
