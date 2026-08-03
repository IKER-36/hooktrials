import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { ProductState } from '../../components/ui/ProductState';
import { PageHeader } from '../../components/ui/PageHeader';
import { apiRequest, readableError } from '../../lib/api';
import type { ReliabilitySummary } from '../../lib/types';

function percentage(value: number | null) {
  return value === null ? '—' : `${value.toFixed(2)}%`;
}

function sloLabel(status: 'no_data' | 'healthy' | 'at_risk' | 'breached') {
  return {
    no_data: 'Collecting evidence',
    healthy: 'Within objective',
    at_risk: 'Budget at risk',
    breached: 'Objective breached',
  }[status];
}

function budgetLabel(
  status: 'no_data' | 'healthy' | 'at_risk' | 'breached',
  remainingPercent: number | null | undefined,
) {
  const label = sloLabel(status);
  if (status === 'no_data' || typeof remainingPercent !== 'number') return label;
  return `${label} · ${remainingPercent.toFixed(0)}% left`;
}

export function ReliabilityPage() {
  const [data, setData] = useState<ReliabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [windowDays, setWindowDays] = useState('7');

  const load = useCallback(async () => {
    const result = await apiRequest<ReliabilitySummary>(
      `/v1/reliability/summary?windowDays=${windowDays}&scope=product`,
    );
    setData(result);
    setError('');
  }, [windowDays]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((cause) => setError(readableError(cause)))
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <section className="ht-page" data-product-area="prove" data-tour-section="reliability">
      <PageHeader
        eyebrow="PROVE / RELIABILITY"
        title="Reliability"
        description="Availability, latency and incident evidence across your monitored dependencies."
        actions={
          <>
            <label className="ht-operation-filter">
              <span className="sr-only">Reliability window</span>
              <select value={windowDays} onChange={(event) => setWindowDays(event.target.value)}>
                <option value="1">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
              </select>
            </label>
            <button className="button secondary compact" type="button" onClick={() => void load()}>
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
          </>
        }
      />

      {error && !data ? (
        <ProductState
          tone="danger"
          eyebrow="Reliability unavailable"
          title="The reliability view could not load."
          description={error}
          action={
            <button className="button primary" type="button" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : loading || !data ? (
        <div className="ht-skeleton tall" />
      ) : (
        <>
          <section className="ht-operation-summary" aria-label="Reliability summary">
            <article className={data.aggregate.onTarget ? 'healthy' : 'danger'}>
              <span>Availability</span>
              <strong>{percentage(data.aggregate.availability)}</strong>
              <small>Objectives per monitor · avg {data.target.toFixed(2)}%</small>
            </article>
            <article>
              <span>Checks recorded</span>
              <strong>{data.aggregate.checks}</strong>
              <small>{data.aggregate.healthy} healthy outcomes</small>
            </article>
            <article>
              <span>P95 latency</span>
              <strong>
                {data.aggregate.p95LatencyMs === null ? '—' : `${data.aggregate.p95LatencyMs} ms`}
              </strong>
              <small>Across all monitors</small>
            </article>
            <article className={data.aggregate.incidents ? 'danger' : 'healthy'}>
              <span>Incidents</span>
              <strong>{data.aggregate.incidents}</strong>
              <small>Opened in this window</small>
            </article>
            <article
              className={
                data.aggregate.sloStatus === 'breached'
                  ? 'danger'
                  : data.aggregate.sloStatus === 'at_risk'
                    ? 'degraded'
                    : 'healthy'
              }
            >
              <span>Error budget</span>
              <strong>
                {data.aggregate.sloStatus === 'no_data' ||
                typeof data.aggregate.budgetRemainingPercent !== 'number'
                  ? '—'
                  : `${data.aggregate.budgetRemainingPercent.toFixed(0)}%`}
              </strong>
              <small>{sloLabel(data.aggregate.sloStatus)}</small>
            </article>
          </section>

          <section className="ht-operation-panel">
            <header>
              <div>
                <h2>Monitor objectives</h2>
                <p className="ht-muted-line">
                  The view uses recorded checks only. No uptime is inferred when a monitor has no
                  evidence.
                </p>
              </div>
              <ShieldCheck aria-hidden="true" />
            </header>
            {data.monitors.length === 0 ? (
              <ProductState
                compact
                eyebrow="No monitors yet"
                title="Create a monitor to establish a reliability baseline."
                description="HTTP, HTTPS and ICMP checks become the evidence behind availability and latency targets."
              />
            ) : (
              <div className="ht-operation-list">
                {data.monitors.map((monitor) => (
                  <article key={monitor.id} className="ht-reliability-row">
                    <div>
                      <h3>{monitor.name}</h3>
                      <p>
                        {monitor.protocol.toUpperCase()} · {monitor.environment} ·{' '}
                        {monitor.metrics.checks} checks · {monitor.windowDays}d window
                      </p>
                    </div>
                    <strong
                      className={
                        monitor.metrics.availability === null ||
                        monitor.metrics.availability >= monitor.target
                          ? 'ht-status-good'
                          : 'ht-status-bad'
                      }
                    >
                      {percentage(monitor.metrics.availability)}
                    </strong>
                    <span>
                      P95{' '}
                      {monitor.metrics.p95LatencyMs === null
                        ? '—'
                        : `${monitor.metrics.p95LatencyMs} ms`}
                    </span>
                    <span>{monitor.metrics.incidents} incidents</span>
                    <span
                      className={
                        monitor.metrics.sloStatus === 'breached'
                          ? 'ht-status-bad'
                          : monitor.metrics.sloStatus === 'at_risk'
                            ? 'ht-status-warning'
                            : 'ht-status-good'
                      }
                    >
                      {budgetLabel(
                        monitor.metrics.sloStatus,
                        monitor.metrics.budgetRemainingPercent,
                      )}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
          <p className="ht-muted-line">
            <Activity aria-hidden="true" /> Window started{' '}
            {new Date(data.windowStartedAt).toLocaleString()}.
          </p>
        </>
      )}
    </section>
  );
}
