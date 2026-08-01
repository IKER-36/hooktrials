import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProductState } from '../../components/ui/ProductState';
import { IntegrationTable } from '../../components/app/monitoring/IntegrationTable';
import { MonitorDetail } from '../../components/app/monitoring/MonitorDetail';
import { MonitorForm } from '../../components/app/monitoring/MonitorForm';
import { StatusPagesPanel } from '../../components/app/monitoring/StatusPagesPanel';
import { STATE_LABEL, type MonitorDetailResponse } from '../../components/app/monitoring/shared';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import type { IntegrationSummary, MonitorSummary, StatusPageConfig } from '../../lib/types';

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
  const editDialogRef = useRef<HTMLDivElement>(null);
  const editCloseRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useFocusTrap(editDialogRef, editing !== null);

  useEffect(() => {
    if (!editing) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => editCloseRef.current?.focus());
    return () => previousFocus.current?.focus();
  }, [editing]);

  const loadMonitors = useCallback(async () => {
    const [response, integrationResponse, statusPageResponse] = await Promise.all([
      apiRequest<{ monitors: MonitorSummary[] }>('/v1/monitors'),
      apiRequest<{ integrations: IntegrationSummary[] }>('/v1/integrations'),
      apiRequest<{ pages: StatusPageConfig[] }>('/v1/status-pages'),
    ]);
    setMonitors(response.monitors);
    setRoutes(integrationResponse.integrations);
    setStatusPages(statusPageResponse.pages);
    setError('');
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
    <section className="ht-page" data-tour-section="monitor" data-product-area="product">
      <PageHeader
        title="Monitoring"
        description="Know what failed, where it failed and when it recovered."
        actions={
          <>
            <Link className="button secondary compact" to="/app/openapi-import">
              Import OpenAPI
            </Link>
            <Link className="button secondary compact" to="/app/operations#alert-channel">
              Configure alerts
            </Link>
            <button
              type="button"
              className="button primary"
              onClick={() => setShowCreate((value) => !value)}
            >
              {showCreate ? 'Close form' : 'New monitor'}
            </button>
          </>
        }
      />

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

      <IntegrationTable
        monitors={monitors}
        routes={routes}
        onSelectMonitor={setSelectedId}
        onSelectRoute={(id) => {
          selectEndpoint(id);
          navigate(`/app/control-center/${id}`);
        }}
      />

      {error ? (
        <ProductState
          compact
          tone="danger"
          eyebrow="Request failed"
          title="Monitoring evidence could not refresh."
          description={error}
          action={
            <button
              className="button secondary compact"
              type="button"
              onClick={() => {
                setError('');
                setLoading(true);
                void loadMonitors()
                  .catch((requestError) => setError(readableError(requestError)))
                  .finally(() => setLoading(false));
              }}
            >
              Try again
            </button>
          }
        />
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

      {loading ? (
        <div className="ht-skeleton tall" />
      ) : monitors.length === 0 && routes.length === 0 && !showCreate && !error ? (
        <ProductState
          title="Add your first monitored integration."
          description="Check an API, HTTP route or webhook destination for availability, latency and response contracts without storing full response bodies."
          action={
            <button type="button" className="button primary" onClick={() => setShowCreate(true)}>
              Create first monitor
            </button>
          }
        />
      ) : monitors.length > 0 ? (
        <div className="ht-monitor-grid">
          <aside className="ht-monitor-list" aria-label="Monitored integrations">
            {monitors.map((monitor) => (
              <button
                key={monitor.id}
                type="button"
                className={`ht-monitor-row ${monitor.id === selectedId ? 'selected' : ''}`}
                aria-pressed={monitor.id === selectedId}
                aria-label={`Select ${monitor.name}, ${STATE_LABEL[monitor.state]}`}
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
            ref={editDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-monitor-title"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              ref={editCloseRef}
              type="button"
              className="button ghost compact ht-modal-close"
              aria-label="Close monitor editor"
              onClick={() => setEditing(null)}
            >
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
