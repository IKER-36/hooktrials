import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CopyButton } from '../../components/ui/CopyButton';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type {
  Incident,
  IntegrationSummary,
  MonitorCheck,
  MonitorState,
  MonitorSummary,
  StatusPageConfig,
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
  const [editing, setEditing] = useState<MonitorSummary | null>(null);
  const [statusPages, setStatusPages] = useState<StatusPageConfig[]>([]);

  const loadMonitors = useCallback(async () => {
    const [response, integrationResponse, statusPageResponse] = await Promise.all([
      apiRequest<{ monitors: MonitorSummary[] }>('/v1/monitors'),
      apiRequest<{ integrations: IntegrationSummary[] }>('/v1/integrations'),
      apiRequest<{ pages: StatusPageConfig[] }>('/v1/status-pages'),
    ]);
    setMonitors(response.monitors);
    setRoutes(integrationResponse.integrations);
    setStatusPages(statusPageResponse.pages);
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
    <section className="ht-page" data-tour-section="monitor">
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
        <MonitorForm
          selfHosted={setup?.deploymentMode === 'selfhost'}
          onSaved={async (id) => {
            setShowCreate(false);
            await loadMonitors();
            setSelectedId(id);
          }}
        />
      ) : null}

      <StatusPagesPanel monitors={monitors} pages={statusPages} onChanged={loadMonitors} />

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
              onEdit={() => setEditing(detail.monitor)}
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
      {editing ? (
        <div className="ht-backdrop" role="presentation" onMouseDown={() => setEditing(null)}>
          <div
            className="ht-monitor-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-monitor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="ht-modal-close" onClick={() => setEditing(null)}>
              ×
            </button>
            <MonitorForm
              monitor={editing}
              selfHosted={setup?.deploymentMode === 'selfhost'}
              onSaved={async (id) => {
                setEditing(null);
                await loadMonitors();
                await loadDetail(id);
              }}
            />
          </div>
        </div>
      ) : null}
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

function StatusPagesPanel({
  monitors,
  pages,
  onChanged,
}: {
  monitors: MonitorSummary[];
  pages: StatusPageConfig[];
  onChanged(): Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<StatusPageConfig | 'new' | null>(null);
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState(() => t('All systems operational'));
  const [description, setDescription] = useState(() =>
    t('Live availability and incident history.'),
  );
  const [accentColor, setAccentColor] = useState('#36e37e');
  const [monitorIds, setMonitorIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  function openEditor(page?: StatusPageConfig) {
    setEditing(page ?? 'new');
    setName(page?.name ?? t('Service status'));
    setHeadline(page?.headline ?? t('All systems operational'));
    setDescription(page?.description ?? t('Live availability and incident history.'));
    setAccentColor(page?.accentColor ?? '#36e37e');
    setMonitorIds(page?.monitorIds ?? monitors.slice(0, 1).map((monitor) => monitor.id));
    setEnabled(page?.enabled ?? true);
    setMessage('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (monitorIds.length === 0) {
      setMessage('Choose at least one monitor.');
      return;
    }
    setBusy('save');
    setMessage('');
    try {
      const current = editing === 'new' ? null : editing;
      await apiRequest(current ? `/v1/status-pages/${current.id}` : '/v1/status-pages', {
        method: current ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          headline,
          description: description || null,
          accentColor,
          monitorIds,
          enabled,
        }),
      });
      setEditing(null);
      await onChanged();
    } catch (requestError) {
      setMessage(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  async function remove(page: StatusPageConfig) {
    if (!window.confirm(`Delete status page “${page.name}”?`)) return;
    setBusy(page.id);
    try {
      await apiRequest(`/v1/status-pages/${page.id}`, { method: 'DELETE' });
      await onChanged();
    } catch (requestError) {
      setMessage(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  async function rotate(page: StatusPageConfig) {
    if (!window.confirm('Rotate this public link? The previous URL will stop working.')) return;
    setBusy(page.id);
    try {
      await apiRequest(`/v1/status-pages/${page.id}/rotate`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      await onChanged();
    } catch (requestError) {
      setMessage(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="ht-status-pages">
      <header>
        <div>
          <p className="ht-kicker">Public communication</p>
          <h2>Status pages</h2>
          <p>Publish a branded, read-only view containing only the monitors you choose.</p>
        </div>
        <button
          type="button"
          className="button"
          disabled={monitors.length === 0}
          onClick={() => openEditor()}
        >
          New status page
        </button>
      </header>
      {pages.length === 0 ? (
        <p className="ht-status-pages-empty">
          {monitors.length === 0
            ? 'Create a monitor before publishing a status page.'
            : 'No custom status page yet. Create one to share selected service health.'}
        </p>
      ) : (
        <div className="ht-status-page-list">
          {pages.map((page) => (
            <article key={page.id} style={{ '--status-accent': page.accentColor } as CSSProperties}>
              <i />
              <div>
                <strong>{page.name}</strong>
                <span>{page.headline}</span>
                <small>
                  {page.monitorIds.length}{' '}
                  {t(page.monitorIds.length === 1 ? 'monitor' : 'monitors')} ·{' '}
                  {t(page.enabled ? 'public' : 'disabled')}
                </small>
              </div>
              <div className="ht-status-page-actions">
                {page.shareUrl ? (
                  <>
                    <a href={page.shareUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <CopyButton value={page.shareUrl} label="Copy link" />
                  </>
                ) : null}
                <button type="button" onClick={() => openEditor(page)}>
                  Edit
                </button>
                <button type="button" onClick={() => void rotate(page)} disabled={busy === page.id}>
                  Rotate
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => void remove(page)}
                  disabled={busy === page.id}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {message && !editing ? <p className="ht-form-error">{message}</p> : null}
      {editing ? (
        <form className="ht-status-page-form" onSubmit={(event) => void save(event)}>
          <div className="ht-monitor-form-grid">
            <label className="ht-field">
              Internal name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label className="ht-field">
              Public headline
              <input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label className="ht-field ht-field-wide">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
              />
            </label>
            <label className="ht-field">
              Accent color
              <input
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
              />
            </label>
            <label className="ht-inline-check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />{' '}
              Public page enabled
            </label>
          </div>
          <fieldset className="ht-status-monitor-picker">
            <legend>Monitors shown publicly</legend>
            {monitors.map((monitor) => (
              <label key={monitor.id}>
                <input
                  type="checkbox"
                  checked={monitorIds.includes(monitor.id)}
                  onChange={(event) =>
                    setMonitorIds((current) =>
                      event.target.checked
                        ? [...current, monitor.id]
                        : current.filter((id) => id !== monitor.id),
                    )
                  }
                />
                <span className={`ht-monitor-state ${monitor.state}`}>
                  {STATE_LABEL[monitor.state]}
                </span>
                <strong>{monitor.name}</strong>
                <small>
                  {monitor.protocol.toUpperCase()} · {monitor.displayHost}
                </small>
              </label>
            ))}
          </fieldset>
          {message ? <p className="ht-form-error">{message}</p> : null}
          <div className="ht-form-actions">
            <button type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={busy === 'save'}>
              {busy === 'save' ? 'Saving…' : 'Save status page'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function MonitorForm({
  selfHosted,
  monitor,
  onSaved,
}: {
  selfHosted: boolean;
  monitor?: MonitorSummary;
  onSaved(id: string): Promise<void>;
}) {
  const [name, setName] = useState(monitor?.name ?? '');
  const [url, setUrl] = useState('');
  const [protocol, setProtocol] = useState(monitor?.protocol ?? 'http');
  const [resourceType, setResourceType] = useState(monitor?.resourceType ?? 'external_api');
  const [environment, setEnvironment] = useState(monitor?.environment ?? 'test');
  const [method, setMethod] = useState(monitor?.method ?? 'GET');
  const [intervalSeconds, setIntervalSeconds] = useState(String(monitor?.intervalSeconds ?? 300));
  const [timeoutMs, setTimeoutMs] = useState(String(monitor?.timeoutMs ?? 10000));
  const [expectedMinStatus, setExpectedMinStatus] = useState(
    String(monitor?.expectedMinStatus ?? 200),
  );
  const [expectedMaxStatus, setExpectedMaxStatus] = useState(
    String(monitor?.expectedMaxStatus ?? 299),
  );
  const [expectedText, setExpectedText] = useState(monitor?.expectedText ?? '');
  const [expectedJsonPath, setExpectedJsonPath] = useState(monitor?.expectedJsonPath ?? '');
  const [headers, setHeaders] = useState('');
  const [clearHeaders, setClearHeaders] = useState(false);
  const [failureThreshold, setFailureThreshold] = useState(
    String(monitor?.consecutiveFailuresToOpen ?? 2),
  );
  const [allowPrivate, setAllowPrivate] = useState(monitor?.allowPrivateNetworks ?? false);
  const [privateCidrs, setPrivateCidrs] = useState(monitor?.allowedPrivateCidrs.join(', ') ?? '');
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
      const payload = {
        name,
        protocol,
        resourceType,
        environment,
        ...(!monitor || url.trim() ? { url } : {}),
        method,
        intervalSeconds: Number(intervalSeconds),
        timeoutMs: Number(timeoutMs),
        expectedMinStatus: Number(expectedMinStatus),
        expectedMaxStatus: Number(expectedMaxStatus),
        expectedText: expectedText || undefined,
        expectedJsonPath: expectedJsonPath || undefined,
        ...(!monitor || headers.trim() || clearHeaders ? { headers: parsedHeaders } : {}),
        consecutiveFailuresToOpen: Number(failureThreshold),
        allowPrivateNetworks: allowPrivate,
        allowedPrivateCidrs: allowPrivate
          ? privateCidrs
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      };
      const response = await apiRequest<{ monitor: { id: string } }>(
        monitor ? `/v1/monitors/${monitor.id}` : '/v1/monitors',
        {
          method: monitor ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      await onSaved(response.monitor.id);
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
          <p className="ht-kicker">{monitor ? 'Edit integration' : 'New integration'}</p>
          <h2 id={monitor ? 'edit-monitor-title' : undefined}>
            {monitor ? 'Update active monitoring' : 'Configure active monitoring'}
          </h2>
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
          Check type
          <select
            value={protocol}
            onChange={(event) => {
              const next = event.target.value as 'http' | 'icmp';
              setProtocol(next);
              setResourceType(next === 'icmp' ? 'icmp_host' : 'external_api');
              setUrl('');
            }}
          >
            <option value="http">HTTP / HTTPS</option>
            <option value="icmp">ICMP ping</option>
          </select>
        </label>
        <label className="ht-field">
          Resource type
          <select
            value={resourceType}
            disabled={protocol === 'icmp'}
            onChange={(event) =>
              setResourceType(event.target.value as MonitorSummary['resourceType'])
            }
          >
            {protocol === 'icmp' ? <option value="icmp_host">ICMP host</option> : null}
            {protocol === 'http' ? (
              <>
                <option value="external_api">External API</option>
                <option value="internal_api">Internal API</option>
                <option value="http_route">HTTP route</option>
                <option value="webhook_destination">Webhook destination</option>
              </>
            ) : null}
          </select>
        </label>
        <label className="ht-field">
          Environment
          <select
            value={environment}
            onChange={(event) =>
              setEnvironment(event.target.value as MonitorSummary['environment'])
            }
          >
            <option value="test">Test</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </label>
        <label className="ht-field ht-field-wide">
          {protocol === 'icmp' ? 'Hostname or IP' : 'Target URL'}
          <input
            type={protocol === 'icmp' ? 'text' : 'url'}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={
              protocol === 'icmp' ? 'service.example.com' : 'https://api.example.com/health'
            }
            required={!monitor || protocol !== monitor.protocol}
          />
          <small>
            {monitor && !url
              ? `Current target: ${monitor.displayUrl}. Leave blank to keep it unchanged.`
              : protocol === 'icmp'
                ? 'Cloud permits publicly routable hosts only. ICMP must be enabled by the target network.'
                : 'Cloud permits public HTTPS targets only. Query values remain encrypted and are hidden from UI.'}
          </small>
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
        {protocol === 'http' ? (
          <>
            <label className="ht-field">
              Method
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as MonitorSummary['method'])}
              >
                <option>GET</option>
                <option>HEAD</option>
                <option>POST</option>
              </select>
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
              {monitor?.hasAuthenticationHeaders ? (
                <label className="ht-inline-check">
                  <input
                    type="checkbox"
                    checked={clearHeaders}
                    onChange={(event) => setClearHeaders(event.target.checked)}
                  />{' '}
                  Remove stored authentication headers
                </label>
              ) : null}
            </label>
          </>
        ) : null}
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
        {submitting ? 'Validating target…' : monitor ? 'Save changes' : 'Create monitor'}
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
  onEdit,
  onDelete,
}: {
  summary: MonitorSummary;
  detail: MonitorDetailResponse;
  busy: string;
  onRun(): void;
  onPause(): void;
  onResume(): void;
  onEdit(): void;
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
          <button type="button" onClick={onEdit} disabled={Boolean(busy)}>
            Edit
          </button>
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
        <span>{summary.protocol.toUpperCase()}</span>
        {summary.protocol === 'http' ? <span>{summary.method}</span> : null}
        <span>every {summary.intervalSeconds / 60}m</span>
        {summary.protocol === 'http' ? (
          <span>
            HTTP {summary.expectedMinStatus}–{summary.expectedMaxStatus}
          </span>
        ) : null}
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
                <code>
                  {check.statusCode ??
                    check.errorCategory ??
                    (summary.protocol === 'icmp' ? 'ICMP' : 'ERROR')}
                </code>
                <strong>{check.latencyMs === null ? '—' : `${check.latencyMs}ms`}</strong>
                <small>
                  {check.contractResult.failures?.[0] ??
                    (summary.protocol === 'icmp'
                      ? 'Host reachable'
                      : check.contractResult.passed
                        ? 'Contract passed'
                        : 'Network check')}
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
