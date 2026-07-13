import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, readableError } from '../../lib/api';
import type { EventSummary, MonitorCheck, OperationsResponse } from '../../lib/types';

type StepState = 'idle' | 'running' | 'passed' | 'failed';

interface DemoSetup {
  runId: string;
  source: { id: string; ingestUrl: string };
  target: { id: string; ingestUrl: string };
  monitor: { id: string; resourceId: string };
  destination: {
    url: string;
    allowPrivateNetworks: boolean;
    allowedPrivateCidrs: string[];
  };
}

const definitions = [
  ['Trial', 'Provider retries are grouped into one 500 → 500 → 200 timeline.'],
  ['Observe', 'One request is proxied synchronously and its destination failure is recorded.'],
  ['Protect', 'The event is accepted first, retried durably and recovered without data loss.'],
  ['Monitor', 'An incident opens after a failed check and closes after recovery.'],
  ['Operations', 'The resulting evidence is summarized for an operator.'],
] as const;

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

async function eventually<T>(operation: () => Promise<T>, ready: (value: T) => boolean) {
  const deadline = Date.now() + 40_000;
  let latest: T | null = null;
  while (Date.now() < deadline) {
    latest = await operation();
    if (ready(latest)) return latest;
    await sleep(600);
  }
  throw new Error(`Demo evidence did not arrive in time${latest ? '.' : ' (no response).'}`);
}

async function postWebhook(url: string, body: string) {
  const crossOrigin = new URL(url).origin !== window.location.origin;
  return fetch(url, {
    method: 'POST',
    body,
    cache: 'no-store',
    credentials: 'omit',
    mode: crossOrigin ? 'no-cors' : 'same-origin',
  });
}

export function DemoPage() {
  const [run, setRun] = useState<DemoSetup | null>(null);
  const [states, setStates] = useState<StepState[]>(definitions.map(() => 'idle'));
  const [message, setMessage] = useState('');
  const [operations, setOperations] = useState<OperationsResponse['summary'] | null>(null);
  const [cleaning, setCleaning] = useState(false);

  function step(index: number, state: StepState) {
    setStates((current) => current.map((value, item) => (item === index ? state : value)));
  }

  async function events(endpointId: string) {
    return apiRequest<{ events: EventSummary[] }>(`/v1/endpoints/${endpointId}/events`);
  }

  async function runJourney() {
    if (states.includes('running') || run) return;
    setStates(definitions.map(() => 'idle'));
    setOperations(null);
    setMessage('Creating isolated, synthetic demo resources…');
    let activeStep = 0;
    try {
      const response = await apiRequest<{ demo: DemoSetup }>('/v1/demo/setup', {
        method: 'POST',
        body: '{}',
      });
      setRun(response.demo);

      step(0, 'running');
      const trialId = `demo-trial-${Date.now()}`;
      const trialBody = JSON.stringify({ id: trialId, type: 'invoice.payment_failed' });
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await postWebhook(response.demo.source.ingestUrl, trialBody);
        if (attempt < 2) await sleep(250);
      }
      await eventually(
        () => events(response.demo.source.id),
        (value) => value.events.some((event) => event.attempts.length >= 3),
      );
      step(0, 'passed');

      activeStep = 1;
      step(1, 'running');
      await apiRequest(`/v1/endpoints/${response.demo.source.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          mode: 'observe',
          destinationUrl: response.demo.destination.url,
          destinationExpectedMinStatus: 200,
          destinationExpectedMaxStatus: 299,
          allowPrivateNetworks: response.demo.destination.allowPrivateNetworks,
          allowedPrivateCidrs: response.demo.destination.allowedPrivateCidrs,
        }),
      });
      const observeId = `demo-observe-${Date.now()}`;
      await postWebhook(
        response.demo.source.ingestUrl,
        JSON.stringify({ id: observeId, type: 'order.created' }),
      );
      await eventually(
        () => events(response.demo.source.id),
        (value) =>
          value.events.some((event) =>
            event.deliveries.some((delivery) => delivery.state === 'failed'),
          ),
      );
      step(1, 'passed');

      activeStep = 2;
      step(2, 'running');
      await apiRequest(`/v1/endpoints/${response.demo.source.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          mode: 'protect',
          retryMaxAttempts: 3,
          retryBaseDelayMs: 1_000,
          retryMaxDelayMs: 5_000,
        }),
      });
      const protectId = `demo-protect-${Date.now()}`;
      await postWebhook(
        response.demo.source.ingestUrl,
        JSON.stringify({ id: protectId, type: 'payment.authorized' }),
      );
      await eventually(
        () => events(response.demo.source.id),
        (value) =>
          value.events.some(
            (event) =>
              event.deliveries.length >= 3 &&
              event.deliveries.some((delivery) => delivery.state === 'succeeded'),
          ),
      );
      step(2, 'passed');

      activeStep = 3;
      step(3, 'running');
      await apiRequest(`/v1/monitors/${response.demo.monitor.id}/resume`, {
        method: 'POST',
        body: '{}',
      });
      for (let check = 0; check < 3; check += 1) {
        const before = await apiRequest<{ checks: MonitorCheck[] }>(
          `/v1/monitors/${response.demo.monitor.id}`,
        );
        await apiRequest(`/v1/monitors/${response.demo.monitor.id}/run`, {
          method: 'POST',
          body: '{}',
        });
        await eventually(
          () => apiRequest<{ checks: MonitorCheck[] }>(`/v1/monitors/${response.demo.monitor.id}`),
          (value) => value.checks.length > before.checks.length,
        );
      }
      const monitor = await apiRequest<{
        monitor: { state: string };
        incidents: Array<{ status: string }>;
      }>(`/v1/monitors/${response.demo.monitor.id}`);
      if (
        monitor.monitor.state !== 'healthy' ||
        !monitor.incidents.some((incident) => incident.status === 'recovered')
      ) {
        throw new Error('The monitor did not produce recovered incident evidence.');
      }
      step(3, 'passed');

      activeStep = 4;
      step(4, 'running');
      const result = await apiRequest<OperationsResponse>('/v1/operations');
      setOperations(result.summary);
      step(4, 'passed');
      setMessage('Reliability journey complete. Explore the evidence, then clean up this run.');
    } catch (error) {
      step(activeStep, 'failed');
      setMessage(error instanceof Error ? error.message : readableError(error));
    }
  }

  async function cleanup() {
    if (!run || cleaning) return;
    setCleaning(true);
    try {
      await apiRequest(`/v1/demo/${run.runId}/cleanup`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      setRun(null);
      setOperations(null);
      setStates(definitions.map(() => 'idle'));
      setMessage('Demo resources removed. Your other endpoints and monitors were not touched.');
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setCleaning(false);
    }
  }

  const running = states.includes('running');
  const complete = states.every((state) => state === 'passed');

  return (
    <section className="ht-page ht-demo-lab">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Demo Lab</p>
          <h1>Break it. Observe it. Recover it.</h1>
          <p className="ht-muted-line">
            One guided journey proves the complete HookTrials control loop with synthetic data.
          </p>
        </div>
        <span className="ht-demo-safety">ISOLATED · USER OWNED · SAFE TO CLEAN</span>
      </header>

      <div className="ht-demo-grid">
        <div className="ht-demo-rail" aria-label="Demo journey progress">
          {definitions.map(([title, description], index) => (
            <article key={title} data-state={states[index]}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <b>{states[index]}</b>
            </article>
          ))}
        </div>

        <aside className="ht-demo-console">
          <p className="ht-kicker">Control surface</p>
          <h2>
            {complete ? 'Journey verified' : running ? 'Running real checks…' : 'Ready to prove it'}
          </h2>
          <p>
            The lab creates two temporary webhook endpoints and one paused monitor. Cleanup matches
            the private run ID and your account before removing anything.
          </p>
          <button
            type="button"
            className="button primary"
            disabled={running || Boolean(run)}
            onClick={() => void runJourney()}
          >
            {running
              ? 'Running reliability journey…'
              : complete
                ? 'Journey complete'
                : 'Run full demo'}
          </button>
          {run ? (
            <button
              type="button"
              className="button secondary"
              disabled={running || cleaning}
              onClick={() => void cleanup()}
            >
              {cleaning ? 'Cleaning…' : 'Clean only this demo run'}
            </button>
          ) : null}
          {message ? <p className="ht-demo-message">{message}</p> : null}
          {operations ? (
            <dl className="ht-demo-proof">
              <div>
                <dt>Open incidents</dt>
                <dd>{operations.openIncidents}</dd>
              </div>
              <div>
                <dt>Recovered / 24h</dt>
                <dd>{operations.recovered24h}</dd>
              </div>
              <div>
                <dt>Protected recoveries</dt>
                <dd>{operations.protectedRecoveries24h}</dd>
              </div>
              <div>
                <dt>Unresolved dead letters</dt>
                <dd>{operations.unresolvedDeadLetters}</dd>
              </div>
            </dl>
          ) : null}
          {complete ? (
            <div className="ht-demo-links">
              <Link to="/app">Inspect timelines</Link>
              <Link to="/app/monitor">Inspect monitor</Link>
              <Link to="/app/operations">Open Operations</Link>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
