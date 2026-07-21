import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import type { EventDetail, EventSummary, MonitorCheck, OperationsResponse } from '../../lib/types';

type StepState = 'idle' | 'running' | 'passed' | 'failed';

interface DemoSetup {
  runId: string;
  trial: { id: string; ingestUrl: string };
  target: { id: string; ingestUrl: string };
  observe: { id: string; ingestUrl: string };
  protect: { id: string; ingestUrl: string; signatureSecret: string };
  deadLetter: { id: string; ingestUrl: string };
  scenario: { id: string; name: string };
  monitors: {
    recovery: { id: string; resourceId: string };
    healthyApi: { id: string; resourceId: string };
    degradedContract: { id: string; resourceId: string };
    downRoute: { id: string; resourceId: string };
    icmpHost: { id: string; resourceId: string };
  };
  statusPage: { id: string; shareUrl: string };
  alertChannel: { id: string | null; demoOwned: boolean };
  destination: {
    url: string;
    allowPrivateNetworks: boolean;
    allowedPrivateCidrs: string[];
  };
}

interface ActiveDemo {
  runId: string;
  createdAt: string;
  resourceCount: number;
  runCount: number;
}

const definitions = [
  ['Scenario Studio', 'A custom cascading-outage recipe is added to the scenario library.'],
  ['Trial', 'Provider retries become one 500 → 503 → 429 → 200 timeline.'],
  ['Observe', 'One request is proxied synchronously and its destination failure is recorded.'],
  ['Protect', 'The event is accepted first, retried durably and recovered without data loss.'],
  ['Monitor', 'HTTP and ICMP checks fill every health state and a public status page.'],
  ['Recovery queue', 'A separate delivery exhausts its retry budget and enters dead-letter.'],
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

async function githubSignature(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const value = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)));
  return `sha256=${Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function postWebhook(url: string, body: string, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    body,
    headers,
    cache: 'no-store',
    credentials: 'omit',
    mode: 'cors',
  });
}

export function DemoPage() {
  const { refresh, selectEndpoint } = useDashboard();
  const [run, setRun] = useState<DemoSetup | null>(null);
  const [activeDemo, setActiveDemo] = useState<ActiveDemo | null>(null);
  const [checkingActive, setCheckingActive] = useState(true);
  const [states, setStates] = useState<StepState[]>(definitions.map(() => 'idle'));
  const [message, setMessage] = useState('');
  const [operations, setOperations] = useState<OperationsResponse['summary'] | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ demo: ActiveDemo | null }>('/v1/demo/active')
      .then((response) => {
        if (cancelled) return;
        setActiveDemo(response.demo);
        if (response.demo) {
          setMessage(
            'An existing Demo Lab workspace was recovered. Reset it safely before running a new journey.',
          );
        }
      })
      .catch((error) => {
        if (!cancelled) setMessage(readableError(error));
      })
      .finally(() => {
        if (!cancelled) setCheckingActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function step(index: number, state: StepState) {
    setStates((current) => current.map((value, item) => (item === index ? state : value)));
  }

  async function events(endpointId: string) {
    return apiRequest<{ events: EventSummary[] }>(`/v1/endpoints/${endpointId}/events`);
  }

  async function runJourney() {
    if (states.includes('running') || run || activeDemo) return;
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
      setActiveDemo({
        runId: response.demo.runId,
        createdAt: new Date().toISOString(),
        resourceCount: 10,
        runCount: 1,
      });
      step(0, 'passed');

      activeStep = 1;
      step(1, 'running');
      const trialId = `demo-trial-${Date.now()}`;
      const trialBody = JSON.stringify({ id: trialId, type: 'invoice.payment_failed' });
      for (let attempt = 0; attempt < 4; attempt += 1) {
        await postWebhook(response.demo.trial.ingestUrl, trialBody);
        if (attempt < 3) await sleep(250);
      }
      const trialEvents = await eventually(
        () => events(response.demo.trial.id),
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
      const observeId = `demo-observe-${Date.now()}`;
      await postWebhook(
        response.demo.observe.ingestUrl,
        JSON.stringify({ id: observeId, type: 'order.created' }),
      );
      await eventually(
        () => events(response.demo.observe.id),
        (value) =>
          value.events.some((event) =>
            event.deliveries.some((delivery) => delivery.state === 'failed'),
          ),
      );
      step(2, 'passed');

      activeStep = 3;
      step(3, 'running');
      const protectId = `demo-protect-${Date.now()}`;
      const protectBody = JSON.stringify({ id: protectId, type: 'push' });
      await postWebhook(response.demo.protect.ingestUrl, protectBody, {
        'content-type': 'application/json',
        'x-github-event': 'push',
        'x-github-delivery': protectId,
        'x-hub-signature-256': await githubSignature(
          response.demo.protect.signatureSecret,
          protectBody,
        ),
      });
      const protectEvents = await eventually(
        () => events(response.demo.protect.id),
        (value) =>
          value.events.some(
            (event) =>
              event.correlationKey === protectId &&
              event.deliveries.length >= 3 &&
              event.deliveries.some((delivery) => delivery.state === 'succeeded'),
          ),
      );
      const protectEvent = protectEvents.events.find((event) => event.correlationKey === protectId);
      if (!protectEvent) throw new Error('The protected event did not prove recovery.');
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
      await apiRequest(`/v1/endpoints/${response.demo.target.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ scenarioId: response.demo.scenario.id }),
      });
      const deadLetterId = `demo-dead-letter-${Date.now()}`;
      await postWebhook(
        response.demo.deadLetter.ingestUrl,
        JSON.stringify({ id: deadLetterId, type: 'fulfillment.delivery_requested' }),
      );
      await eventually(
        () => events(response.demo.deadLetter.id),
        (value) =>
          value.events.some(
            (event) =>
              event.correlationKey === deadLetterId &&
              event.deliveries.some((delivery) => delivery.state === 'dead_letter'),
          ),
      );
      step(5, 'passed');

      activeStep = 6;
      step(6, 'running');
      const result = await eventually(
        () => apiRequest<OperationsResponse>('/v1/operations'),
        (value) =>
          value.summary.openIncidents >= 1 &&
          value.summary.recovered24h >= 2 &&
          value.summary.protectedRecoveries24h >= 1 &&
          value.summary.unresolvedDeadLetters >= 1 &&
          value.alerts.filter(
            (alert) => alert.resourceName.startsWith('Demo') && alert.state === 'sent',
          ).length >= 6,
      );
      setOperations(result.summary);
      setAlertCount(
        result.alerts.filter(
          (alert) => alert.resourceName.startsWith('Demo') && alert.state === 'sent',
        ).length,
      );
      step(6, 'passed');

      activeStep = 7;
      step(7, 'running');
      await eventually(
        () => apiRequest<{ event: EventDetail }>(`/v1/events/${protectEvent.id}`),
        (value) => value.event.report?.status === 'passed',
      );
      const evidence = await apiRequest<{ shareUrl: string; expiresAt: string }>(
        `/v1/events/${protectEvent.id}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ confirm: true, expiresInHours: 24 }),
        },
      );
      setEvidenceUrl(evidence.shareUrl);
      selectEndpoint(response.demo.protect.id);
      await refresh();
      step(7, 'passed');
      setMessage('Full workspace ready. Every module now contains safe, inspectable evidence.');
    } catch (error) {
      step(activeStep, 'failed');
      setMessage(error instanceof Error ? error.message : readableError(error));
    }
  }

  async function cleanup() {
    const runId = run?.runId ?? activeDemo?.runId;
    if (!runId || cleaning) return;
    setCleaning(true);
    try {
      await apiRequest(run ? `/v1/demo/${runId}/cleanup` : '/v1/demo/reset', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      setRun(null);
      setActiveDemo(null);
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
  const hasActiveDemo = Boolean(run || activeDemo);

  return (
    <section className="ht-page ht-demo-lab" data-tour-section="demo" data-product-area="lab">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Reliability Lab · guided demo</p>
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
            The lab creates isolated Trial, Observe and Protect routes, a synthetic destination, one
            custom scenario, five monitored integrations, a multi-monitor public status page, a
            recoverable dead letter, incident and alert evidence, plus one expiring report. Cleanup
            matches the private run ID and your account before removing anything.
          </p>
          {activeDemo && !run ? (
            <div className="ht-demo-recovered" role="status">
              <b>Existing workspace recovered</b>
              <span>
                {activeDemo.resourceCount} resources · run <code>{activeDemo.runId}</code>
              </span>
              <small>
                {activeDemo.runCount > 1
                  ? `${activeDemo.runCount} historical demo runs were found. Reset removes all of them, scoped to your account.`
                  : 'Your browser can be closed safely. HookTrials remembers the private run and keeps cleanup scoped to your account.'}
              </small>
            </div>
          ) : null}
          <button
            type="button"
            className="button primary"
            disabled={checkingActive || running || hasActiveDemo}
            onClick={() => void runJourney()}
          >
            {running
              ? 'Running reliability journey…'
              : checkingActive
                ? 'Checking demo workspace…'
                : complete
                  ? 'Journey complete'
                  : 'Run full demo'}
          </button>
          {hasActiveDemo ? (
            <button
              type="button"
              className="button secondary"
              disabled={running || cleaning}
              onClick={() => void cleanup()}
            >
              {cleaning ? 'Cleaning…' : run ? 'Clean only this demo run' : 'Reset demo workspace'}
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
                <dd>5</dd>
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
              <Link to="/app/live-webhooks">Open Webhook Hub</Link>
              <Link to="/app/scenarios">Open failure scenarios</Link>
              <Link to="/app/monitor">Inspect monitoring</Link>
              {run?.statusPage.shareUrl ? (
                <a href={run.statusPage.shareUrl} target="_blank" rel="noreferrer">
                  Open public status page
                </a>
              ) : null}
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
