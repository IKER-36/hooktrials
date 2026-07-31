import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Link2, RefreshCw, Share2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CopyButton } from '../../components/ui/CopyButton';
import { ProductState } from '../../components/ui/ProductState';
import { useI18n } from '../../i18n/I18nContext';
import { useDashboard } from '../../layouts/AppLayout';
import { API_ORIGIN, apiRequest, readableError } from '../../lib/api';
import { shortDate, timeAgo } from '../../lib/format';
import type { EvidenceReport } from '../../lib/types';

type ReportFilter = 'all' | 'passed' | 'failed' | 'pending';

function statusLabel(status: EvidenceReport['report']['status'], t: (value: string) => string) {
  if (status === 'passed') return t('Passed');
  if (status === 'failed') return t('Needs review');
  return t('Pending');
}

function outcomeLabel(outcome: EvidenceReport['replay']['outcome'], t: (value: string) => string) {
  if (outcome === 'recovered') return t('Recovery proven');
  if (outcome === 'protected') return t('Delivery protected');
  if (outcome === 'failed') return t('Action required');
  if (outcome === 'delivered') return t('Delivered');
  return t('Received');
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(durationMs >= 10_000 ? 0 : 1)} s`;
}

function EvidenceSteps({ report }: { report: EvidenceReport }) {
  return (
    <ol className="ht-evidence-steps">
      {report.replay.steps.map((step, index) => (
        <li key={step.code} className={step.state}>
          <span className="ht-evidence-step-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="ht-evidence-step-marker" aria-hidden="true" />
          <span className="ht-evidence-step-copy">
            <b>{step.label}</b>
            <small>{step.detail}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function EvidenceReportsPage() {
  const { endpoints } = useDashboard();
  const { t } = useI18n();
  const [reports, setReports] = useState<EvidenceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ReportFilter>('all');
  const [endpointFilter, setEndpointFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await apiRequest<{ reports: EvidenceReport[] }>('/v1/evidence?limit=100');
      setReports(response.reports);
      setError('');
      setSelectedId((current) => current ?? response.reports[0]?.id ?? null);
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const counts = useMemo(
    () => ({
      all: reports.length,
      passed: reports.filter((report) => report.report.status === 'passed').length,
      failed: reports.filter((report) => report.report.status === 'failed').length,
      pending: reports.filter((report) => report.report.status === 'pending').length,
      recovered: reports.filter((report) => report.replay.outcome === 'recovered').length,
    }),
    [reports],
  );

  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      if (filter !== 'all' && report.report.status !== filter) return false;
      if (endpointFilter !== 'all' && report.endpointId !== endpointFilter) return false;
      if (!query) return true;
      return [
        report.integration.name,
        report.event.correlationKey,
        report.integration.environment,
        report.integration.mode,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [endpointFilter, filter, reports, search]);

  const selected = visibleReports.find((report) => report.id === selectedId) ?? visibleReports[0];

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    if (!selected) setShareUrl('');
  }, [selected, selectedId]);

  async function createShareLink(report: EvidenceReport) {
    setShareBusy(true);
    setError('');
    try {
      const response = await apiRequest<{ shareUrl: string; expiresAt: string }>(
        `/v1/events/${report.eventId}/share`,
        { method: 'POST', body: JSON.stringify({ expiresInHours: 24, confirm: true }) },
      );
      setShareUrl(response.shareUrl);
      setReports((items) =>
        items.map((item) =>
          item.id === report.id
            ? { ...item, share: { active: true, expiresAt: response.expiresAt } }
            : item,
        ),
      );
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <section className="ht-page ht-evidence-reports" data-product-area="resources">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">{t('EVIDENCE CENTER')}</p>
          <h1>{t('Evidence & reports')}</h1>
          <p className="ht-muted-line">
            {t('Explain what happened, prove recovery and share a redacted record safely.')}
          </p>
        </div>
        <button className="button secondary" type="button" onClick={() => void load()}>
          <RefreshCw aria-hidden="true" /> {t('Refresh reports')}
        </button>
      </header>

      {error && reports.length > 0 ? (
        <p className="ht-inline-notice" role="status">
          {t('The last known reports remain visible.')} <span>{error}</span>
        </p>
      ) : null}

      {!loading && error && reports.length === 0 ? (
        <ProductState
          tone="danger"
          eyebrow={t('Evidence unavailable')}
          title={t('Reports could not load.')}
          description={error}
          action={
            <button className="button primary" type="button" onClick={() => void load()}>
              {t('Try again')}
            </button>
          }
        />
      ) : loading ? (
        <div className="ht-skeleton tall" aria-label={t('Loading reports')} />
      ) : reports.length === 0 ? (
        <ProductState
          title={t('No evidence reports yet.')}
          description={t(
            'Run a Trial or send a live event. HookTrials will generate a redacted report after the delivery chain is recorded.',
          )}
          action={
            <Link className="button primary" to="/app/control-center">
              {t('Open Control Center')}
            </Link>
          }
        />
      ) : (
        <>
          <section className="ht-evidence-metrics" aria-label={t('Evidence summary')}>
            <article>
              <span>{t('Reports')}</span>
              <strong>{counts.all}</strong>
            </article>
            <article className="positive">
              <span>{t('Passed')}</span>
              <strong>{counts.passed}</strong>
            </article>
            <article className={counts.failed ? 'warning' : ''}>
              <span>{t('Needs review')}</span>
              <strong>{counts.failed}</strong>
            </article>
            <article>
              <span>{t('Recovery proven')}</span>
              <strong>{counts.recovered}</strong>
            </article>
          </section>

          <section className="ht-evidence-workspace">
            <div className="ht-evidence-inventory">
              <header>
                <div>
                  <p className="ht-kicker">{t('RECORDED EVENTS')}</p>
                  <h2>{t('Evidence timeline')}</h2>
                </div>
                <span>{visibleReports.length}</span>
              </header>
              <div className="ht-evidence-controls">
                <label className="ht-search-field">
                  <span className="sr-only">{t('Search reports')}</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('Search by route or event')}
                  />
                </label>
                <label className="ht-evidence-select">
                  <span className="sr-only">{t('Filter by endpoint')}</span>
                  <select
                    value={endpointFilter}
                    onChange={(event) => setEndpointFilter(event.target.value)}
                  >
                    <option value="all">{t('All routes')}</option>
                    {endpoints.map((endpoint) => (
                      <option key={endpoint.id} value={endpoint.id}>
                        {endpoint.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="ht-evidence-filters" role="tablist" aria-label={t('Report status')}>
                {(
                  [
                    ['all', `${t('All')} ${counts.all}`],
                    ['passed', `${t('Passed')} ${counts.passed}`],
                    ['failed', `${t('Review')} ${counts.failed}`],
                    ['pending', `${t('Pending')} ${counts.pending}`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    className={filter === value ? 'active' : ''}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {visibleReports.length === 0 ? (
                <ProductState
                  compact
                  title={t('No reports match this view.')}
                  description={t('Clear a filter or search for another event.')}
                  action={
                    <button
                      className="button secondary compact"
                      type="button"
                      onClick={() => {
                        setFilter('all');
                        setEndpointFilter('all');
                        setSearch('');
                      }}
                    >
                      {t('Show all reports')}
                    </button>
                  }
                />
              ) : (
                <div className="ht-evidence-list">
                  {visibleReports.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      className={`ht-evidence-row ${selected?.id === report.id ? 'active' : ''}`}
                      aria-pressed={selected?.id === report.id}
                      onClick={() => {
                        setSelectedId(report.id);
                        setShareUrl('');
                      }}
                    >
                      <span className={`ht-evidence-status ${report.report.status}`}>
                        {statusLabel(report.report.status, t)}
                      </span>
                      <span className="ht-evidence-row-copy">
                        <strong>{report.integration.name}</strong>
                        <small>
                          {report.event.correlationKey} · {report.integration.mode} ·{' '}
                          {timeAgo(report.event.lastSeenAt)}
                        </small>
                      </span>
                      <span className="ht-evidence-row-score">
                        <b>{report.report.score ?? '—'}</b>
                        <small>/100</small>
                      </span>
                      <span className="ht-evidence-row-counts">
                        {report.attemptCount} {t('attempts')} · {report.deliveryCount}{' '}
                        {t('deliveries')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected ? (
              <article className="ht-evidence-detail" aria-label={t('Selected evidence report')}>
                <header className="ht-evidence-detail-head">
                  <div>
                    <p className="ht-kicker">{t('EXPLAINABLE REPORT')}</p>
                    <h2>{selected.integration.name}</h2>
                    <p className="ht-muted-line">
                      {selected.event.correlationKey} · {selected.integration.mode} ·{' '}
                      {selected.integration.environment}
                    </p>
                  </div>
                  <span className={`ht-evidence-status ${selected.report.status}`}>
                    {statusLabel(selected.report.status, t)}
                  </span>
                </header>

                <div className="ht-evidence-detail-actions">
                  <Link
                    className="button secondary compact"
                    to={`/app/control-center/${selected.endpointId}`}
                  >
                    <ExternalLink aria-hidden="true" /> {t('Open route control')}
                  </Link>
                  <a
                    className="button secondary compact"
                    href={`${API_ORIGIN}/v1/events/${selected.eventId}/export?format=json`}
                  >
                    <Download aria-hidden="true" /> JSON
                  </a>
                  <a
                    className="button secondary compact"
                    href={`${API_ORIGIN}/v1/events/${selected.eventId}/export?format=markdown`}
                  >
                    <Download aria-hidden="true" /> Markdown
                  </a>
                </div>

                <div className="ht-evidence-score-panel">
                  <div>
                    <span>{t('Resilience score')}</span>
                    <strong>
                      {selected.report.score ?? '—'}
                      <small>/100</small>
                    </strong>
                  </div>
                  <div>
                    <span>{t('Outcome')}</span>
                    <b>{outcomeLabel(selected.replay.outcome, t)}</b>
                  </div>
                  <div>
                    <span>{t('Recorded')}</span>
                    <b>{shortDate(selected.event.lastSeenAt)}</b>
                  </div>
                </div>

                <section className="ht-evidence-replay-summary">
                  <div className="ht-evidence-replay-icon">
                    <ShieldCheck aria-hidden="true" />
                  </div>
                  <div>
                    <p className="ht-kicker">{t('RECOVERY READOUT')}</p>
                    <h3>{selected.replay.headline}</h3>
                    <p>{selected.replay.diagnosis}</p>
                  </div>
                </section>

                <section className="ht-evidence-impact-grid" aria-label={t('Impact and recovery')}>
                  <div>
                    <span>{t('Impact')}</span>
                    <p>{selected.replay.impact}</p>
                  </div>
                  <div>
                    <span>{t('Duration')}</span>
                    <p>{formatDuration(selected.replay.durationMs)}</p>
                  </div>
                  <div>
                    <span>{t('Evidence chain')}</span>
                    <p>
                      {selected.attemptCount} {t('attempts')} · {selected.deliveryCount}{' '}
                      {t('deliveries')}
                    </p>
                  </div>
                </section>

                <section className="ht-evidence-detail-section">
                  <header>
                    <p className="ht-kicker">{t('RECOVERY TIMELINE')}</p>
                    <h3>{t('What happened')}</h3>
                  </header>
                  <EvidenceSteps report={selected} />
                </section>

                <section className="ht-evidence-share-panel">
                  <div>
                    <p className="ht-kicker">{t('SAFE HANDOFF')}</p>
                    <h3>{t('Share redacted evidence')}</h3>
                    <p>
                      {t(
                        'Create a temporary link with no payloads, secrets, credentials or destination URLs.',
                      )}
                    </p>
                  </div>
                  {shareUrl ? (
                    <div className="ht-evidence-share-result">
                      <code>{shareUrl}</code>
                      <CopyButton
                        value={shareUrl}
                        label={t('Copy link')}
                        copiedLabel={t('Copied')}
                      />
                    </div>
                  ) : (
                    <button
                      className="button primary compact"
                      type="button"
                      disabled={shareBusy}
                      onClick={() => void createShareLink(selected)}
                    >
                      <Share2 aria-hidden="true" />{' '}
                      {shareBusy ? t('Creating…') : t('Create 24h link')}
                    </button>
                  )}
                  {selected.share.active && !shareUrl ? (
                    <small className="ht-form-success">
                      <Link2 aria-hidden="true" />{' '}
                      {t('A share link is already active for this report.')}
                    </small>
                  ) : null}
                </section>
              </article>
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
