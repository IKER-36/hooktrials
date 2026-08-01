import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertChannelPanel } from '../../components/app/AlertChannelPanel';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProductState } from '../../components/ui/ProductState';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import { shortDate, timeAgo } from '../../lib/format';
import type {
  Incident,
  OperationalDeadLetter,
  OperationsResponse,
  WorkspaceMember,
  WorkspaceResponse,
} from '../../lib/types';

type DeliveryAction = { delivery: OperationalDeadLetter; kind: 'retry' | 'replay' };

export function OperationsPage() {
  const { selectEndpoint } = useDashboard();
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState<
    'all' | 'open' | 'unacknowledged' | 'recovered'
  >('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [triageBusy, setTriageBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<DeliveryAction | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [response, workspace] = await Promise.all([
      apiRequest<OperationsResponse>('/v1/operations'),
      apiRequest<WorkspaceResponse>('/v1/workspace'),
    ]);
    setData(response);
    setMembers(workspace.members);
    setError('');
  }, []);

  useEffect(() => {
    load()
      .catch((requestError) => setError(readableError(requestError)))
      .finally(() => setLoading(false));
    const timer = window.setInterval(
      () => void load().catch((requestError) => setError(readableError(requestError))),
      10_000,
    );
    return () => window.clearInterval(timer);
  }, [load]);

  const deadLetters = useMemo(
    () => data?.deadLetters.filter((delivery) => showResolved || !delivery.resolved) ?? [],
    [data, showResolved],
  );

  const incidents = useMemo(() => {
    const rows = data?.incidents ?? [];
    if (incidentFilter === 'open') return rows.filter((incident) => incident.status === 'open');
    if (incidentFilter === 'recovered') {
      return rows.filter((incident) => incident.status === 'recovered');
    }
    if (incidentFilter === 'unacknowledged') {
      return rows.filter((incident) => incident.status === 'open' && !incident.acknowledgedAt);
    }
    return rows;
  }, [data, incidentFilter]);

  async function runDeliveryAction() {
    if (!pendingAction) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/v1/deliveries/${pendingAction.delivery.id}/${pendingAction.kind}`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      setPendingAction(null);
      await load();
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function updateIncident(
    incident: Incident,
    patch: { acknowledged?: boolean; note?: string | null; assigneeUserId?: string | null },
  ) {
    setTriageBusy(incident.id);
    setError('');
    try {
      await apiRequest(`/v1/incidents/${incident.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await load();
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setTriageBusy(null);
    }
  }

  return (
    <section className="ht-page" data-tour-section="operations" data-product-area="product">
      <PageHeader
        eyebrow="PRODUCT / OPERATIONS"
        title="Operations"
        description="Triage incidents, recover dead letters and verify alert delivery from one queue."
        actions={
          <button type="button" className="button secondary" onClick={() => void load()}>
            Refresh evidence
          </button>
        }
      />

      {error && data ? (
        <ProductState
          compact
          tone="danger"
          eyebrow="Refresh failed"
          title="The last known operations evidence is still visible."
          description={error}
          action={
            <button className="button secondary compact" type="button" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : null}
      {!data && error ? (
        <ProductState
          tone="danger"
          eyebrow="Request failed"
          title="Operations could not load."
          description={error}
          action={
            <button
              className="button primary"
              type="button"
              onClick={() => {
                setError('');
                setLoading(true);
                void load()
                  .catch((requestError) => setError(readableError(requestError)))
                  .finally(() => setLoading(false));
              }}
            >
              Try again
            </button>
          }
        />
      ) : loading || !data ? (
        <div className="ht-skeleton tall" />
      ) : (
        <>
          <section className="ht-operation-summary" aria-label="Operations summary">
            <article className={data.summary.openIncidents ? 'danger' : 'healthy'}>
              <span>Open incidents</span>
              <strong>{data.summary.openIncidents}</strong>
            </article>
            <article className={data.summary.unacknowledgedOpenIncidents ? 'danger' : 'healthy'}>
              <span>Needs acknowledgement</span>
              <strong>{data.summary.unacknowledgedOpenIncidents}</strong>
            </article>
            <article>
              <span>Recovered 24h</span>
              <strong>{data.summary.recovered24h}</strong>
            </article>
            <article className={data.summary.unresolvedDeadLetters ? 'danger' : 'healthy'}>
              <span>Unresolved DLQ</span>
              <strong>{data.summary.unresolvedDeadLetters}</strong>
            </article>
            <article>
              <span>Protected recoveries</span>
              <strong>{data.summary.protectedRecoveries24h}</strong>
            </article>
          </section>

          <section id="incident-timeline" className="ht-operation-panel">
            <header>
              <div>
                <h2>Incident timeline</h2>
              </div>
              <label className="ht-operation-filter">
                <span className="sr-only">Incident filter</span>
                <select
                  value={incidentFilter}
                  onChange={(event) =>
                    setIncidentFilter(
                      event.target.value as 'all' | 'open' | 'unacknowledged' | 'recovered',
                    )
                  }
                >
                  <option value="all">All incidents</option>
                  <option value="unacknowledged">Needs acknowledgement</option>
                  <option value="open">Open</option>
                  <option value="recovered">Recovered</option>
                </select>
              </label>
            </header>
            {incidents.length === 0 ? (
              <ProductState
                compact
                eyebrow="No action required"
                title={
                  data.incidents.length === 0
                    ? 'No incidents are open.'
                    : 'No incidents match this filter.'
                }
                description={
                  data.incidents.length === 0
                    ? 'Create a monitor or run a protected webhook test to start collecting operational evidence.'
                    : 'Change the filter to review another part of the incident history.'
                }
                action={
                  data.incidents.length === 0 ? (
                    <Link className="button secondary compact" to="/app/monitor">
                      Open monitoring
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="ht-operation-list">
                {incidents.map((incident) => (
                  <article
                    key={incident.id}
                    className={`ht-incident-row ${incident.acknowledgedAt ? 'acknowledged' : ''} ${incident.status}`}
                    aria-label={`${incident.resourceName} · ${incident.status}`}
                  >
                    <span
                      className={`ht-monitor-state ${incident.status === 'open' ? 'down' : 'healthy'}`}
                    >
                      {incident.status}
                    </span>
                    <div>
                      <strong>{incident.resourceName}</strong>
                      <p>{incident.summary}</p>
                    </div>
                    <code>{incident.cause}</code>
                    <small>
                      {incident.status === 'open'
                        ? `opened ${timeAgo(incident.openedAt)}`
                        : `recovered ${incident.recoveredAt ? timeAgo(incident.recoveredAt) : '—'}`}
                    </small>
                    <div className="ht-incident-triage">
                      <div className="ht-operation-actions">
                        <label>
                          <span className="sr-only">Assignee</span>
                          <select
                            value={incident.assigneeUserId ?? ''}
                            disabled={triageBusy === incident.id}
                            onChange={(event) =>
                              void updateIncident(incident, {
                                assigneeUserId: event.target.value || null,
                              })
                            }
                          >
                            <option value="">Unassigned</option>
                            {members.map((member) => (
                              <option key={member.userId} value={member.userId}>
                                {member.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="button secondary compact"
                          disabled={triageBusy === incident.id}
                          onClick={() =>
                            void updateIncident(incident, {
                              acknowledged: !incident.acknowledgedAt,
                            })
                          }
                        >
                          {incident.acknowledgedAt ? 'Unacknowledge' : 'Acknowledge'}
                        </button>
                        {incident.acknowledgedAt ? (
                          <span className="ht-incident-ack">Acknowledged</span>
                        ) : null}
                      </div>
                      <div className="ht-incident-note">
                        <input
                          value={noteDrafts[incident.id] ?? incident.resolutionNote ?? ''}
                          onChange={(event) =>
                            setNoteDrafts((current) => ({
                              ...current,
                              [incident.id]: event.target.value,
                            }))
                          }
                          placeholder="Add an operator note"
                          aria-label={`Note for ${incident.resourceName}`}
                          maxLength={2_000}
                        />
                        <button
                          type="button"
                          className="button quiet compact"
                          disabled={triageBusy === incident.id}
                          onClick={() =>
                            void updateIncident(incident, {
                              note:
                                (noteDrafts[incident.id] ?? incident.resolutionNote ?? '').trim() ||
                                null,
                            })
                          }
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                    {incident.resolutionNote ? (
                      <p className="ht-incident-note-readonly">{incident.resolutionNote}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="recovery-queue" className="ht-operation-panel">
            <header>
              <div>
                <h2>Dead-letter inbox</h2>
              </div>
              <label className="ht-operation-toggle">
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(event) => setShowResolved(event.target.checked)}
                />{' '}
                Show resolved
              </label>
            </header>
            {deadLetters.length === 0 ? (
              <ProductState
                compact
                tone="positive"
                eyebrow="Recovery queue"
                title={
                  showResolved
                    ? 'No resolved deliveries match this view.'
                    : 'Recovery queue is clear.'
                }
                description="Failed protected deliveries that exhaust their retry budget will appear here with explicit retry and replay controls."
              />
            ) : (
              <div className="ht-dlq-list">
                {deadLetters.map((delivery) => (
                  <article
                    key={delivery.id}
                    className={`ht-dlq-row ${delivery.resolved ? 'resolved' : ''}`}
                    aria-label={`${delivery.resourceName} · ${delivery.resolved ? 'recovered' : 'dead letter'}`}
                  >
                    <div>
                      <span
                        className={`ht-monitor-state ${delivery.resolved ? 'healthy' : 'down'}`}
                      >
                        {delivery.resolved
                          ? 'recovered'
                          : delivery.recoveryPending
                            ? 'retrying'
                            : 'dead letter'}
                      </span>
                      <strong>{delivery.resourceName}</strong>
                      <code>{delivery.correlationKey}</code>
                    </div>
                    <p>
                      {delivery.errorMessage ??
                        delivery.errorCategory ??
                        `HTTP ${delivery.statusCode ?? '—'}`}
                    </p>
                    <small>
                      {shortDate(delivery.createdAt)} · attempt {delivery.sequence}
                    </small>
                    <div className="ht-operation-actions">
                      <Link
                        to={`/app/control-center/${delivery.endpointId}`}
                        onClick={() => selectEndpoint(delivery.endpointId)}
                      >
                        Open journey
                      </Link>
                      {!delivery.resolved && !delivery.recoveryPending ? (
                        <>
                          <button
                            type="button"
                            className="button secondary compact"
                            onClick={() => setPendingAction({ delivery, kind: 'retry' })}
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            className="button secondary compact"
                            onClick={() => setPendingAction({ delivery, kind: 'replay' })}
                          >
                            Replay
                          </button>
                        </>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ht-operation-panel">
            <header>
              <div>
                <h2>Alert audit</h2>
              </div>
              <span>{data.alerts.length} deliveries</span>
            </header>
            {data.alerts.length === 0 ? (
              <ProductState
                compact
                title="No alert delivery evidence yet."
                description="Configure Discord or a generic webhook below, choose its scope, and send a test notification."
              />
            ) : (
              <div className="ht-alert-audit-list">
                {data.alerts.map((alert) => (
                  <article
                    key={alert.id}
                    className="ht-alert-row"
                    aria-label={`${alert.resourceName} · ${alert.event}`}
                  >
                    <span
                      className={`ht-monitor-state ${alert.state === 'sent' ? 'healthy' : alert.state === 'failed' ? 'down' : 'degraded'}`}
                    >
                      {alert.state}
                    </span>
                    <strong>{alert.resourceName}</strong>
                    <code>{alert.event}</code>
                    <small>
                      {alert.statusCode
                        ? `HTTP ${alert.statusCode}`
                        : (alert.errorCategory ?? 'pending')}{' '}
                      · {timeAgo(alert.createdAt)}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Configuration sits after the triage evidence, but outside the data
          branch so alerts stay reachable — and the #alert-channel anchor keeps
          working — even when the operations request fails. */}
      <AlertChannelPanel />

      <ConfirmDialog
        open={pendingAction !== null}
        title={`${pendingAction?.kind === 'replay' ? 'Replay' : 'Retry'} this delivery?`}
        body={
          pendingAction?.kind === 'replay'
            ? 'Replay creates a clearly labelled new delivery and records your user ID, source delivery and request time.'
            : 'Retry continues recovery from this dead-letter delivery and records your user ID, source delivery and request time.'
        }
        confirmLabel={pendingAction?.kind === 'replay' ? 'Confirm replay' : 'Confirm retry'}
        busy={busy}
        onConfirm={() => void runDeliveryAction()}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  );
}
