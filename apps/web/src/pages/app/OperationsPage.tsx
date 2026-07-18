import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertChannelPanel } from '../../components/app/AlertChannelPanel';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import { shortDate, timeAgo } from '../../lib/format';
import type { OperationalDeadLetter, OperationsResponse } from '../../lib/types';

type DeliveryAction = { delivery: OperationalDeadLetter; kind: 'retry' | 'replay' };

export function OperationsPage() {
  const { selectEndpoint } = useDashboard();
  const [data, setData] = useState<OperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [pendingAction, setPendingAction] = useState<DeliveryAction | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await apiRequest<OperationsResponse>('/v1/operations');
    setData(response);
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

  return (
    <section className="ht-page" data-tour-section="operations" data-product-area="live">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Live operations</p>
          <h1>Operations</h1>
          <p className="ht-muted-line">
            Triage incidents, recover dead letters and verify alert delivery from one queue.
          </p>
        </div>
        <button type="button" className="button secondary" onClick={() => void load()}>
          Refresh evidence
        </button>
      </header>

      {error ? (
        <p className="ht-form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading || !data ? (
        <div className="ht-skeleton tall" />
      ) : (
        <>
          <section className="ht-operation-summary" aria-label="Operations summary">
            <article className={data.summary.openIncidents ? 'danger' : 'healthy'}>
              <span>Open incidents</span>
              <strong>{data.summary.openIncidents}</strong>
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

          <section className="ht-operation-panel">
            <header>
              <div>
                <p className="ht-kicker">Incident timeline</p>
                <h2>What failed and recovered</h2>
              </div>
              <span>{data.incidents.length} retained</span>
            </header>
            {data.incidents.length === 0 ? (
              <p className="ht-operation-empty">No incident evidence yet.</p>
            ) : (
              <div className="ht-operation-list">
                {data.incidents.map((incident) => (
                  <article key={incident.id}>
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
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ht-operation-panel">
            <header>
              <div>
                <p className="ht-kicker">Dead-letter inbox</p>
                <h2>Deliveries needing a decision</h2>
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
              <p className="ht-operation-empty">No unresolved dead letters.</p>
            ) : (
              <div className="ht-dlq-list">
                {deadLetters.map((delivery) => (
                  <article key={delivery.id} className={delivery.resolved ? 'resolved' : ''}>
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
                      <Link to="/app" onClick={() => selectEndpoint(delivery.endpointId)}>
                        Open journey
                      </Link>
                      {!delivery.resolved && !delivery.recoveryPending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPendingAction({ delivery, kind: 'retry' })}
                          >
                            Retry
                          </button>
                          <button
                            type="button"
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
                <p className="ht-kicker">Alert audit</p>
                <h2>Recent outgoing notifications</h2>
              </div>
              <span>{data.alerts.length} deliveries</span>
            </header>
            {data.alerts.length === 0 ? (
              <p className="ht-operation-empty">Configure the channel below, then send a test.</p>
            ) : (
              <div className="ht-alert-audit-list">
                {data.alerts.map((alert) => (
                  <article key={alert.id}>
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
