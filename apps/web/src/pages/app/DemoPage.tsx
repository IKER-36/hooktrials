import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import type { EventDetail, EventSummary, MonitorCheck, OperationsResponse } from '../../lib/types';

type StepState = 'idle' | 'running' | 'passed' | 'failed';

interface DemoSetup {
  runId: string;
  source: { id: string; ingestUrl: string };
  target: { id: string; ingestUrl: string };
  scenario: { id: string; name: string };
  monitors: {
    recovery: { id: string; resourceId: string };
    healthyApi: { id: string; resourceId: string };
    degradedContract: { id: string; resourceId: string };
    downRoute: { id: string; resourceId: string };
  };
  alertChannel: { id: string | null; demoOwned: boolean };
  destination: {
    url: string;
    allowPrivateNetworks: boolean;
    allowedPrivateCidrs: string[];
  };
}

const definitions = [
  ['Scenario Studio', 'A custom cascading-outage recipe is added to the scenario library.'],
  ['Trial', 'Provider retries become one 500 → 503 → 429 → 200 timeline.'],
  ['Observe', 'One request is proxied synchronously and its destination failure is recorded.'],
  ['Protect', 'The event is accepted first, retried durably and recovered without data loss.'],
  ['Monitor', 'API, internal, route and destination checks fill every health state.'],
  ['Operations', 'Open and recovered incidents, retries and safe alert audit share one queue.'],
  ['Evidence', 'A redacted, expiring report proves the recovered Trial sequence.'],
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
  const { refresh } = useDashboard();
  const [run, setRun] = useState<DemoSetup | null>(null);
  const [states, setStates] = useState<StepState[]>(definitions.map(() => 'idle'));
  const [message, setMessage] = useState('');
  const [operations, setOperations] = useState<OperationsResponse['summary'] | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [evidenceUrl, setEvidenceUrl] = useState('');
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
    setAlertCount(0);
    setEvidenceUrl('');
    setMessage('Creating isolated, synthetic demo resources…');
    let activeStep = 0;
    try {
      step(0, 'running');
      const response = await apiRequest<{ demo: DemoSetup }>('/v1/demo/setup', {
        method: 'POST',
        body: '{}',
      });
      setRun(response.demo);
      step(0, 'passed');

      activeStep = 1;
      step(1, 'running');
      const trialId = `demo-trial-${Date.now()}`;
      const trialBody = JSON.stringify({ id: trialId, type: 'invoice.payment_failed' });
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await postWebhook(response.demo.source.ingestUrl, trialBody);
        if (attempt < 3) await sleep(250);
      }
      const trialEvents = await eventually(
        () => events(response.demo.source.id),
        (value) =>
          value.events.some(
            (event) => event.correlationKey === trialId && event.attempts.length >= 4,
          ),
      );
      const trialEvent = trialEvents.events.find((event) => event.correlationKey === trialId);
      if (!trialEvent) throw new Error('The Trial event did not produce a complete timeline.');
      step(1, 'passed');

      activeStep = 2;
      step(2, 'running');
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
      step(2, 'passed');

      activeStep = 3;
      step(3, 'running');
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
      step(3, 'passed');

      async function runMonitor(monitorId: string, checkCount: number) {
        await apiRequest(`/v1/monitors/${monitorId}/resume`, {
          method: 'POST',
          body: '{}',
        });
        for (let check = 0; check < checkCount; check += 1) {
          const before = await apiRequest<{ checks: MonitorCheck[] }>(`/v1/monitors/${monitorId}`);
          await apiRequest(`/v1/monitors/${monitorId}/run`, {
            method: 'POST',
            body: '{}',
          });
          await eventually(
            () => apiRequest<{ checks: MonitorCheck[] }>(`/v1/monitors/${monitorId}`),
            (value) => value.checks.length > before.checks.length,
          );
        }
      }

      activeStep = 4;
      step(4, 'running');
      await runMonitor(response.demo.monitors.recovery.id, 3);
      await runMonitor(response.demo.monitors.healthyApi.id, 3);
      await runMonitor(response.demo.monitors.degradedContract.id, 1);
      await runMonitor(response.demo.monitors.downRoute.id, 1);
      const [recovery, healthy, degraded, down] = await Promise.all([
        apiRequest<{ monitor: { state: string }; incidents: Array<{ status: string }> }>(
          `/v1/monitors/${response.demo.monitors.recovery.id}`,
        ),
        apiRequest<{ monitor: { state: string } }>(
          `/v1/monitors/${response.demo.monitors.healthyApi.id}`,
        ),
        apiRequest<{ monitor: { state: string } }>(
          `/v1/monitors/${response.demo.monitors.degradedContract.id}`,
        ),
        apiRequest<{ monitor: { state: string }; incidents: Array<{ status: string }> }>(
          `/v1/monitors/${response.demo.monitors.downRoute.id}`,
        ),
      ]);
      if (
        recovery.monitor.state !== 'healthy' ||
        !recovery.incidents.some((incident) => incident.status === 'recovered') ||
        healthy.monitor.state !== 'healthy' ||
        degraded.monitor.state !== 'degraded' ||
        down.monitor.state !== 'down' ||
        !down.incidents.some((incident) => incident.status === 'open')
      ) {
        throw new Error('The monitor catalogue did not produce every expected health state.');
      }
      step(4, 'passed');

      activeStep = 5;
      step(5, 'running');
      const result = await eventually(
        () => apiRequest<OperationsResponse>('/v1/operations'),
        (value) =>
          value.summary.openIncidents >= 1 &&
          value.summary.recovered24h >= 2 &&
          value.summary.protectedRecoveries24h >= 1 &&
          value.alerts.filter(
            (alert) => alert.resourceName.startsWith('Demo') && alert.state === 'sent',
          ).length >= 5,
      );
      setOperations(result.summary);
      setAlertCount(
        result.alerts.filter(
          (alert) => alert.resourceName.startsWith('Demo') && alert.state === 'sent',
        ).length,
      );
      step(5, 'passed');

      activeStep = 6;
      step(6, 'running');
      await eventually(
        () => apiRequest<{ event: EventDetail }>(`/v1/events/${trialEvent.id}`),
        (value) => value.event.report?.status === 'passed',
      );
      const evidence = await apiRequest<{ shareUrl: string; expiresAt: string }>(
        `/v1/events/${trialEvent.id}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ confirm: true, expiresInHours: 24 }),
        },
      );
      setEvidenceUrl(evidence.shareUrl);
      await refresh();
      step(6, 'passed');
      setMessage('Full workspace ready. Every module now contains safe, inspectable evidence.');
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
      setAlertCount(0);
      setEvidenceUrl('');
      setStates(definitions.map(() => 'idle'));
      await refresh();
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
            One click fills every HookTrials module with a realistic, synthetic reliability
            workspace.
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
            The lab creates two endpoints, one custom scenario, four monitored integrations,
            incident and alert evidence, plus one expiring report. Cleanup matches the private run
            ID and your account before removing anything.
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
              <div>
                <dt>Monitor catalogue</dt>
                <dd>4</dd>
              </div>
              <div>
                <dt>Demo alerts audited</dt>
                <dd>{alertCount}</dd>
              </div>
            </dl>
          ) : null}
          {complete ? (
            <div className="ht-demo-links">
              <Link to="/app">Inspect timelines</Link>
              <Link to="/app/scenarios">Open Scenario Studio</Link>
              <Link to="/app/monitor">Inspect monitor</Link>
              <Link to="/app/operations">Open Operations</Link>
              {evidenceUrl ? (
                <a href={evidenceUrl} target="_blank" rel="noreferrer">
                  Open redacted evidence
                </a>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
