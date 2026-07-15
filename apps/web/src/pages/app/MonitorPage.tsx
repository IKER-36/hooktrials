import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CopyButton } from '../../components/ui/CopyButton';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type {
  Incident,
  IntegrationSummary,
  MonitorCheck,
  MonitorState,
  MonitorSummary,
} from '../../lib/types';

const STATE_LABEL: Record<MonitorState, string> = {
  new: 'NEW',
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  down: 'DOWN',
  paused: 'PAUSED',
};

interface MonitorDetailResponse {
  monitor: MonitorSummary;
  checks: MonitorCheck[];
  incidents: Incident[];
}

function metric(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value}${suffix}`;
}

export function MonitorPage() {
  const navigate = useNavigate();
  const { setup } = useAuth();
  const { selectEndpoint } = useDashboard();
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [routes, setRoutes] = useState<IntegrationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MonitorDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState<MonitorSummary | null>(null);

  const loadMonitors = useCallback(async () => {
    const [response, integrationResponse] = await Promise.all([
      apiRequest<{ monitors: MonitorSummary[] }>('/v1/monitors'),
      apiRequest<{ integrations: IntegrationSummary[] }>('/v1/integrations'),
    ]);
    setMonitors(response.monitors);
    setRoutes(integrationResponse.integrations);
    setSelectedId((current) =>
      response.monitors.some((monitor) => monitor.id === current)
        ? current
        : (response.monitors[0]?.id ?? null),
    );
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const response = await apiRequest<MonitorDetailResponse>(`/v1/monitors/${id}`);
    setDetail(response);
  }, []);

  useEffect(() => {
    loadMonitors()
      .catch((requestError) => setError(readableError(requestError)))
      .finally(() => setLoading(false));
    const timer = window.setInterval(
      () => void loadMonitors().catch((requestError) => setError(readableError(requestError))),
      10_000,
    );
    return () => window.clearInterval(timer);
  }, [loadMonitors]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId).catch((requestError) => setError(readableError(requestError)));
    const timer = window.setInterval(
      () =>
        void loadDetail(selectedId).catch((requestError) => setError(readableError(requestError))),
      10_000,
    );
    return () => window.clearInterval(timer);
  }, [selectedId, loadDetail]);

  const totals = useMemo(
    () => ({
      healthy: [...monitors, ...routes].filter((item) => item.state === 'healthy').length,
      degraded: [...monitors, ...routes].filter((item) => item.state === 'degraded').length,
      down: [...monitors, ...routes].filter((item) => item.state === 'down').length,
      incidents: [...monitors, ...routes].filter((item) => item.incident).length,
    }),
    [monitors, routes],
  );

  async function action(path: string, label: string) {
    setBusy(label);
    setError('');
    try {
      await apiRequest(path, { method: 'POST' });
      await loadMonitors();
      if (selectedId) await loadDetail(selectedId);
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy('delete');
    try {
      await apiRequest(`/v1/monitors/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      setDetail(null);
      await loadMonitors();
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="ht-page">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Integration health</p>
          <h1>Monitor</h1>
          <p className="ht-muted-line">Know what failed, where it failed and when it recovered.</p>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => setShowCreate((value) => !value)}
        >
          {showCreate ? 'Close form' : 'New monitor'}
        </button>
      </header>

      <section className="ht-monitor-summary" aria-label="Monitor summary">
        <article>
          <span>Resources</span>
          <strong>{monitors.length + routes.length}</strong>
        </article>
        <article className="healthy">
          <span>Healthy</span>
          <strong>{totals.healthy}</strong>
        </article>
        <article className="degraded">
          <span>Degraded</span>
          <strong>{totals.degraded}</strong>
        </article>
        <article className="down">
          <span>Down</span>
          <strong>{totals.down}</strong>
        </article>
        <article className="incident">
          <span>Open incidents</span>
          <strong>{totals.incidents}</strong>
        </article>
      </section>

      <UnifiedIntegrationTable
        monitors={monitors}
        routes={routes}
        onSelectMonitor={setSelectedId}
        onSelectRoute={(id) => {
          selectEndpoint(id);
          navigate('/app');
        }}
      />

      {error ? (
        <p className="ht-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {showCreate ? (
        <CreateMonitorForm
          selfHosted={setup?.deploymentMode === 'selfhost'}
          onCreated={async (id) => {
            setShowCreate(false);
            await loadMonitors();
            setSelectedId(id);
          }}
        />
      ) : null}

      {routes.length > 0 ? (
        <section className="ht-managed-routes" aria-label="Managed webhook routes">
          <header>
            <div>
              <p className="ht-kicker">Passive signals</p>
              <h2>Managed webhook routes</h2>
            </div>
            <span>Provider → validation → destination</span>
          </header>
          <div>
            {routes.map((route) => (
              <article key={route.id}>
                <span className={`ht-monitor-state ${route.state}`}>
                  {STATE_LABEL[route.state]}
                </span>
                <strong>{route.name}</strong>
                <small>
                  {route.mode} · {route.environment} · {route.destinationHost ?? 'no destination'}
                </small>
                <span>
                  {route.latestDelivery
                    ? `${route.latestDelivery.statusCode ? `HTTP ${route.latestDelivery.statusCode}` : (route.latestDelivery.errorCategory ?? route.latestDelivery.state)} · ${route.latestDelivery.latencyMs ?? '—'} ms`
                    : 'Waiting for real traffic'}
                </span>
                <b
                  className="ht-score-mini"
                  title={`${route.score.deductions.length} evidence-based deductions`}
                >
                  {route.score.score}/100
                </b>
                <Link to="/app" onClick={() => selectEndpoint(route.endpointId)}>
                  Open journey →
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="ht-skeleton tall" />
      ) : monitors.length === 0 && routes.length === 0 && !showCreate ? (
        <div className="ht-onboarding ht-monitor-empty">
          <h2>Add your first integration</h2>
          <p className="ht-muted-line">
            Monitor an API, HTTP route or webhook destination. HookTrials checks availability,
            latency and response contracts without storing full response bodies.
          </p>
          <button type="button" className="button primary" onClick={() => setShowCreate(true)}>
            Create first monitor
          </button>
        </div>
      ) : monitors.length > 0 ? (
        <div className="ht-monitor-grid">
          <aside className="ht-monitor-list" aria-label="Monitored integrations">
            {monitors.map((monitor) => (
              <button
                key={monitor.id}
                type="button"
                className={monitor.id === selectedId ? 'selected' : ''}
                onClick={() => setSelectedId(monitor.id)}
              >
                <span className={`ht-monitor-state ${monitor.state}`}>
                  {STATE_LABEL[monitor.state]}
                </span>
                <strong>{monitor.name}</strong>
                <small>
                  {monitor.resourceType.replaceAll('_', ' ')} · {monitor.environment}
                </small>
                <code>{monitor.displayHost}</code>
                <b className="ht-score-mini">{monitor.score.score}/100</b>
              </button>
            ))}
          </aside>
          {detail ? (
            <MonitorDetail
              summary={monitors.find((monitor) => monitor.id === selectedId) ?? detail.monitor}
              detail={detail}
              busy={busy}
              onRun={() => void action(`/v1/monitors/${detail.monitor.id}/run`, 'run')}
              onPause={() => void action(`/v1/monitors/${detail.monitor.id}/pause`, 'pause')}
              onResume={() => void action(`/v1/monitors/${detail.monitor.id}/resume`, 'resume')}
              onDelete={() =>
                setDeleting(monitors.find((monitor) => monitor.id === selectedId) ?? detail.monitor)
              }
            />
          ) : (
            <div className="ht-skeleton tall" />
          )}
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.name ?? ''}”?`}
        body="This permanently removes its checks, metrics and incident history. It does not affect the monitored service."
        confirmLabel="Delete monitor"
        busy={busy === 'delete'}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}

function UnifiedIntegrationTable({
  monitors,
  routes,
  onSelectMonitor,
  onSelectRoute,
}: {
  monitors: MonitorSummary[];
  routes: IntegrationSummary[];
  onSelectMonitor(id: string): void;
  onSelectRoute(id: string): void;
}) {
  if (monitors.length === 0 && routes.length === 0) return null;
  return (
    <section className="ht-integration-table" aria-label="All integrations">
      <header>
        <div>
          <p className="ht-kicker">Unified inventory</p>
          <h2>All integrations</h2>
        </div>
        <span>Active checks + real webhook traffic</span>
      </header>
      <div className="ht-integration-table-head" aria-hidden="true">
        <span>Integration</span>
        <span>Type</span>
        <span>Environment</span>
        <span>Mode</span>
        <span>Status</span>
        <span>Score</span>
        <span>Latency</span>
        <span>Latest issue</span>
      </div>
      {routes.map((route) => (
        <button key={route.id} type="button" onClick={() => onSelectRoute(route.endpointId)}>
          <strong>{route.name}</strong>
          <span>webhook</span>
          <span>{route.environment}</span>
          <span>{route.mode}</span>
          <span className={`ht-monitor-state ${route.state}`}>{STATE_LABEL[route.state]}</span>
          <b>{route.score.score}/100</b>
          <code>{route.latestDelivery?.latencyMs ?? '—'} ms</code>
          <small>{route.incident?.cause ?? route.latestDelivery?.errorCategory ?? 'None'}</small>
        </button>
      ))}
      {monitors.map((monitor) => (
        <button key={monitor.id} type="button" onClick={() => onSelectMonitor(monitor.id)}>
          <strong>{monitor.name}</strong>
          <span>{monitor.resourceType.replaceAll('_', ' ')}</span>
          <span>{monitor.environment}</span>
          <span>monitor</span>
          <span className={`ht-monitor-state ${monitor.state}`}>{STATE_LABEL[monitor.state]}</span>
          <b>{monitor.score.score}/100</b>
          <code>{monitor.metrics.latest?.latencyMs ?? '—'} ms</code>
          <small>
            {monitor.incident?.cause ?? monitor.metrics.latest?.errorCategory ?? 'None'}
          </small>
        </button>
      ))}
    </section>
  );
}

function CreateMonitorForm({
  selfHosted,
  onCreated,
}: {
  selfHosted: boolean;
  onCreated(id: string): Promise<void>;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [resourceType, setResourceType] = useState('external_api');
  const [environment, setEnvironment] = useState('test');
  const [method, setMethod] = useState('GET');
  const [intervalSeconds, setIntervalSeconds] = useState('300');
  const [timeoutMs, setTimeoutMs] = useState('10000');
  const [expectedMinStatus, setExpectedMinStatus] = useState('200');
  const [expectedMaxStatus, setExpectedMaxStatus] = useState('299');
  const [expectedText, setExpectedText] = useState('');
  const [expectedJsonPath, setExpectedJsonPath] = useState('');
  const [headers, setHeaders] = useState('');
  const [failureThreshold, setFailureThreshold] = useState('2');
  const [allowPrivate, setAllowPrivate] = useState(false);
  const [privateCidrs, setPrivateCidrs] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      let parsedHeaders: Record<string, string> = {};
      if (headers.trim()) {
        const value = JSON.parse(headers) as unknown;
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('Headers must be a JSON object.');
        parsedHeaders = value as Record<string, string>;
      }
      const response = await apiRequest<{ monitor: { id: string } }>('/v1/monitors', {
        method: 'POST',
        body: JSON.stringify({
          name,
          resourceType,
          environment,
          url,
          method,
          intervalSeconds: Number(intervalSeconds),
          timeoutMs: Number(timeoutMs),
          expectedMinStatus: Number(expectedMinStatus),
          expectedMaxStatus: Number(expectedMaxStatus),
          expectedText: expectedText || undefined,
          expectedJsonPath: expectedJsonPath || undefined,
          headers: parsedHeaders,
          consecutiveFailuresToOpen: Number(failureThreshold),
          allowPrivateNetworks: allowPrivate,
          allowedPrivateCidrs: allowPrivate
            ? privateCidrs
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
        }),
      });
      await onCreated(response.monitor.id);
    } catch (requestError) {
      setFormError(
        requestError instanceof SyntaxError ||
          (requestError instanceof Error &&
            !(requestError instanceof TypeError) &&
            requestError.message === 'Headers must be a JSON object.')
          ? requestError.message
          : readableError(requestError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="ht-monitor-create" onSubmit={(event) => void submit(event)}>
      <header>
        <div>
          <p className="ht-kicker">New integration</p>
          <h2>Configure active monitoring</h2>
        </div>
        <span>Secrets encrypted at rest</span>
      </header>
      <div className="ht-monitor-form-grid">
        <label className="ht-field">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="GitHub API"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label className="ht-field">
          Resource type
          <select value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
            <option value="external_api">External API</option>
            <option value="internal_api">Internal API</option>
            <option value="http_route">HTTP route</option>
            <option value="webhook_destination">Webhook destination</option>
          </select>
        </label>
        <label className="ht-field">
          Environment
          <select value={environment} onChange={(event) => setEnvironment(event.target.value)}>
            <option value="test">Test</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </label>
        <label className="ht-field ht-field-wide">
          Target URL
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://api.example.com/health"
            required
          />
          <small>
            Cloud permits public HTTPS targets only. Query values remain encrypted and are hidden
            from UI.
          </small>
        </label>
        <label className="ht-field">
          Method
          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option>GET</option>
            <option>HEAD</option>
            <option>POST</option>
          </select>
        </label>
        <label className="ht-field">
          Frequency
          <select
            value={intervalSeconds}
            onChange={(event) => setIntervalSeconds(event.target.value)}
          >
            <option value="60">Every minute</option>
            <option value="300">Every 5 minutes</option>
            <option value="900">Every 15 minutes</option>
          </select>
        </label>
        <label className="ht-field">
          Timeout (ms)
          <input
            type="number"
            min="1000"
            max="30000"
            step="500"
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(event.target.value)}
          />
        </label>
        <label className="ht-field">
          Failures before Down
          <input
            type="number"
            min="1"
            max="10"
            value={failureThreshold}
            onChange={(event) => setFailureThreshold(event.target.value)}
          />
        </label>
        <label className="ht-field">
          Expected status from
          <input
            type="number"
            min="100"
            max="599"
            value={expectedMinStatus}
            onChange={(event) => setExpectedMinStatus(event.target.value)}
          />
        </label>
        <label className="ht-field">
          Expected status to
          <input
            type="number"
            min="100"
            max="599"
            value={expectedMaxStatus}
            onChange={(event) => setExpectedMaxStatus(event.target.value)}
          />
        </label>
        <label className="ht-field">
          Expected text (optional)
          <input
            value={expectedText}
            onChange={(event) => setExpectedText(event.target.value)}
            placeholder="operational"
            maxLength={256}
          />
        </label>
        <label className="ht-field">
          JSON path (optional)
          <input
            value={expectedJsonPath}
            onChange={(event) => setExpectedJsonPath(event.target.value)}
            placeholder="$.data.ready"
          />
        </label>
        <label className="ht-field ht-field-wide">
          Authentication headers (optional JSON)
          <textarea
            value={headers}
            onChange={(event) => setHeaders(event.target.value)}
            placeholder='{"authorization":"Bearer …"}'
          />
          <small>Values are write-only after creation and never returned by API.</small>
        </label>
      </div>
      {selfHosted ? (
        <div className="ht-private-monitor">
          <label>
            <input
              type="checkbox"
              checked={allowPrivate}
              onChange={(event) => setAllowPrivate(event.target.checked)}
            />{' '}
            Monitor explicitly allowed private network
          </label>
          {allowPrivate ? (
            <label className="ht-field">
              Allowed CIDRs
              <input
                value={privateCidrs}
                onChange={(event) => setPrivateCidrs(event.target.value)}
                placeholder="10.20.0.0/16, 192.168.50.0/24"
                required
              />
              <small>
                HTTP and private destinations become available only inside these ranges.
              </small>
            </label>
          ) : null}
        </div>
      ) : null}
      {formError ? (
        <p className="ht-form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <button type="submit" className="button primary" disabled={submitting}>
        {submitting ? 'Validating target…' : 'Create monitor'}
      </button>
    </form>
  );
}

function MonitorDetail({
  summary,
  detail,
  busy,
  onRun,
  onPause,
  onResume,
  onDelete,
}: {
  summary: MonitorSummary;
  detail: MonitorDetailResponse;
  busy: string;
  onRun(): void;
  onPause(): void;
  onResume(): void;
  onDelete(): void;
}) {
  const latestIncident = detail.incidents[0] ?? null;
  const [statusUrl, setStatusUrl] = useState('');
  const [statusEnabled, setStatusEnabled] = useState(Boolean(summary.publicStatusEnabled));
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    setStatusUrl('');
    setStatusEnabled(Boolean(summary.publicStatusEnabled));
    setStatusMessage('');
  }, [summary.id]);

  useEffect(() => {
    setStatusEnabled(Boolean(summary.publicStatusEnabled));
  }, [summary.publicStatusEnabled]);

  async function publishStatus() {
    setStatusBusy(true);
    setStatusMessage('');
    try {
      const response = await apiRequest<{ shareUrl: string }>(
        `/v1/monitors/${summary.id}/status-page`,
        { method: 'POST', body: JSON.stringify({ confirm: true }) },
      );
      setStatusUrl(response.shareUrl);
      setStatusEnabled(true);
      setStatusMessage('Public link created. Creating another link rotates this one.');
    } catch (requestError) {
      setStatusMessage(readableError(requestError));
    } finally {
      setStatusBusy(false);
    }
  }

  async function disableStatus() {
    setStatusBusy(true);
    setStatusMessage('');
    try {
      await apiRequest(`/v1/monitors/${summary.id}/status-page`, { method: 'DELETE' });
      setStatusUrl('');
      setStatusEnabled(false);
      setStatusMessage('Public status disabled. Previous links no longer work.');
    } catch (requestError) {
      setStatusMessage(readableError(requestError));
    } finally {
      setStatusBusy(false);
    }
  }
  return (
    <article className="ht-monitor-detail">
      <header>
        <div>
          <span className={`ht-monitor-state ${summary.state}`}>{STATE_LABEL[summary.state]}</span>
          <h2>{summary.name}</h2>
          <code>{summary.displayUrl}</code>
        </div>
        <div className="ht-monitor-actions">
          <button
            type="button"
            onClick={onRun}
            disabled={Boolean(busy) || summary.state === 'paused'}
          >
            {busy === 'run' ? 'Queued…' : 'Run now'}
          </button>
          {summary.state === 'paused' ? (
            <button type="button" onClick={onResume} disabled={Boolean(busy)}>
              Resume
            </button>
          ) : (
            <button type="button" onClick={onPause} disabled={Boolean(busy)}>
              Pause
            </button>
          )}
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </header>
      {summary.incident ? (
        <section className="ht-monitor-incident">
          <strong>OPEN INCIDENT · {summary.incident.cause.toUpperCase()}</strong>
          <p>{summary.incident.summary}</p>
          <small>Opened {timeAgo(summary.incident.openedAt)}</small>
        </section>
      ) : summary.state === 'healthy' ? (
        <p className="ht-monitor-nominal">
          No open incident. Latest evidence passes configured expectations.
        </p>
      ) : null}
      <section className="ht-monitor-metrics">
        <article>
          <span>Availability 1h</span>
          <strong>{metric(summary.metrics.availability1h, '%')}</strong>
        </article>
        <article>
          <span>Availability 24h</span>
          <strong>{metric(summary.metrics.availability24h, '%')}</strong>
        </article>
        <article>
          <span>Average latency</span>
          <strong>{metric(summary.metrics.averageLatencyMs, 'ms')}</strong>
        </article>
        <article>
          <span>p95 latency</span>
          <strong>{metric(summary.metrics.p95LatencyMs, 'ms')}</strong>
        </article>
        <article>
          <span>Checks 24h</span>
          <strong>{summary.metrics.checks24h}</strong>
        </article>
      </section>
      <section className="ht-monitor-config">
        <span>{summary.resourceType.replaceAll('_', ' ')}</span>
        <span>{summary.environment}</span>
        <span>{summary.method}</span>
        <span>every {summary.intervalSeconds / 60}m</span>
        <span>
          HTTP {summary.expectedMinStatus}–{summary.expectedMaxStatus}
        </span>
        {summary.hasAuthenticationHeaders ? <span>auth configured</span> : null}
      </section>
      <section className="ht-status-share">
        <div>
          <p className="ht-kicker">Public status</p>
          <h3>Share availability without exposing credentials</h3>
          <p>
            Publishes the integration name, monitored host, health metrics, recent checks and
            incident summaries. Authentication headers and response bodies are never included.
          </p>
        </div>
        <div className="ht-status-share-actions">
          <button type="button" onClick={() => void publishStatus()} disabled={statusBusy}>
            {statusBusy
              ? 'Working…'
              : statusEnabled
                ? 'Rotate public link'
                : 'Create public status'}
          </button>
          {statusEnabled || statusUrl ? (
            <button
              type="button"
              className="danger"
              onClick={() => void disableStatus()}
              disabled={statusBusy}
            >
              Disable
            </button>
          ) : null}
        </div>
        {statusUrl ? (
          <div className="ht-status-share-url">
            <code>{statusUrl}</code>
            <CopyButton value={statusUrl} label="Copy status link" />
            <a href={statusUrl} target="_blank" rel="noreferrer">
              Open →
            </a>
          </div>
        ) : null}
        {statusMessage ? <small role="status">{statusMessage}</small> : null}
      </section>
      <section className="ht-score-card" aria-label="Explainable reliability score">
        <header>
          <div>
            <p className="ht-kicker">Explainable score</p>
            <h3>
              {summary.score.score}
              <small>/100</small>
            </h3>
          </div>
          <span>
            {summary.score.deductions.length === 0
              ? 'No deductions'
              : `${summary.score.deductions.length} evidence deductions`}
          </span>
        </header>
        {summary.score.deductions.length > 0 ? (
          <ul>
            {summary.score.deductions.map((deduction) => (
              <li key={deduction.code}>
                <strong>−{deduction.points}</strong>
                <span>{deduction.label}</span>
                <code>{JSON.stringify(deduction.evidence)}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>Current checks show no reliability penalty.</p>
        )}
      </section>
      <section className="ht-monitor-history">
        <header>
          <div>
            <p className="ht-kicker">Evidence</p>
            <h3>Recent checks</h3>
          </div>
          <small>Auto-refreshes every 10s</small>
        </header>
        {detail.checks.length === 0 ? (
          <div className="ht-events-empty">
            <h3>First check queued.</h3>
            <p>Worker will run it shortly. Use Run now to prioritize it.</p>
          </div>
        ) : (
          <div className="ht-check-list">
            {detail.checks.map((check) => (
              <article key={check.id}>
                <span className={`ht-check-outcome ${check.outcome}`}>
                  {check.outcome.toUpperCase()}
                </span>
                <time>{timeAgo(check.startedAt)}</time>
                <code>{check.statusCode ?? check.errorCategory ?? 'ERROR'}</code>
                <strong>{check.latencyMs === null ? '—' : `${check.latencyMs}ms`}</strong>
                <small>
                  {check.contractResult.failures?.[0] ??
                    (check.contractResult.passed ? 'Contract passed' : 'Network check')}
                </small>
              </article>
            ))}
          </div>
        )}
      </section>
      {latestIncident?.status === 'recovered' ? (
        <p className="ht-monitor-recovery">
          Latest incident recovered{' '}
          {latestIncident.recoveredAt ? timeAgo(latestIncident.recoveredAt) : ''}:{' '}
          {latestIncident.summary}
        </p>
      ) : null}
    </article>
  );
}
