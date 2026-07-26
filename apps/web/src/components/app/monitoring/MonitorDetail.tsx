import { useEffect, useState } from 'react';
import { CopyButton } from '../../ui/CopyButton';
import { apiRequest, readableError } from '../../../lib/api';
import { timeAgo } from '../../../lib/format';
import { RECENT_CHECK_LIMIT, STATE_LABEL, metric, type MonitorDetailResponse } from './shared';
import type { MonitorSummary } from '../../../lib/types';

export function MonitorDetail({
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
          <button
            type="button"
            className="button secondary compact"
            onClick={onEdit}
            disabled={Boolean(busy)}
          >
            Edit
          </button>
          <button
            type="button"
            className="button secondary compact"
            onClick={onRun}
            disabled={Boolean(busy) || summary.state === 'paused'}
            aria-busy={busy === 'run'}
          >
            {busy === 'run' ? 'Queued…' : 'Run now'}
          </button>
          {summary.state === 'paused' ? (
            <button
              type="button"
              className="button secondary compact"
              onClick={onResume}
              disabled={Boolean(busy)}
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              className="button secondary compact"
              onClick={onPause}
              disabled={Boolean(busy)}
            >
              Pause
            </button>
          )}
          <button type="button" className="button danger compact" onClick={onDelete}>
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
          <h3>Public status</h3>
          <p>
            Publishes the integration name, monitored host, health metrics, recent checks and
            incident summaries. Authentication headers and response bodies are never included.
          </p>
        </div>
        <div className="ht-status-share-actions">
          <button
            type="button"
            className="button secondary compact"
            onClick={() => void publishStatus()}
            disabled={statusBusy}
            aria-busy={statusBusy}
          >
            {statusBusy
              ? 'Working…'
              : statusEnabled
                ? 'Rotate public link'
                : 'Create public status'}
          </button>
          {statusEnabled || statusUrl ? (
            <button
              type="button"
              className="button danger compact"
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
            <h3>Recent checks</h3>
            {detail.checks.length > RECENT_CHECK_LIMIT ? (
              <p className="ht-history-scope">
                Showing <b>{RECENT_CHECK_LIMIT}</b> of <b>{detail.checks.length}</b>
              </p>
            ) : null}
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
            {detail.checks.slice(0, RECENT_CHECK_LIMIT).map((check) => (
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
