import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest, readableError } from '../../lib/api';
import { clockTime, shortDate, shortHash } from '../../lib/format';
import type { AttemptDetail, EventDetail } from '../../lib/types';
import { CopyButton } from '../ui/CopyButton';
import { statusTone } from '../ui/StatusChip';

function isRedacted(value: unknown): boolean {
  return typeof value === 'string' && value.toLowerCase().includes('redacted');
}

function ReportResult({ result }: { result: unknown }) {
  if (result === null || typeof result !== 'object') return null;
  const entries = Object.entries(result as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <dl className="ht-report-result">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            {typeof value === 'object' && value !== null ? (
              <code>{JSON.stringify(value)}</code>
            ) : (
              String(value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function BodyViewer({ attempt }: { attempt: AttemptDetail }) {
  const [mode, setMode] = useState<'raw' | 'json'>('raw');
  const parsedJson = useMemo(() => {
    if (!attempt.body) return null;
    try {
      return JSON.stringify(JSON.parse(attempt.body), null, 2);
    } catch {
      return null;
    }
  }, [attempt.body]);

  useEffect(() => {
    setMode(parsedJson ? 'json' : 'raw');
  }, [parsedJson, attempt.id]);

  if (!attempt.body) {
    return (
      <div className="ht-body-empty">
        <span>EMPTY BODY</span> This attempt carried no payload.
      </div>
    );
  }

  return (
    <div className="ht-body-viewer">
      <div className="ht-body-toolbar">
        {parsedJson ? (
          <div className="ht-toggle" role="group" aria-label="Body format">
            <button
              type="button"
              className={mode === 'json' ? 'active' : ''}
              aria-pressed={mode === 'json'}
              onClick={() => setMode('json')}
            >
              JSON
            </button>
            <button
              type="button"
              className={mode === 'raw' ? 'active' : ''}
              aria-pressed={mode === 'raw'}
              onClick={() => setMode('raw')}
            >
              RAW
            </button>
          </div>
        ) : (
          <span className="ht-body-kind">RAW</span>
        )}
        <CopyButton value={attempt.body} label="Copy body" />
      </div>
      <pre className="ht-payload">{mode === 'json' && parsedJson ? parsedJson : attempt.body}</pre>
    </div>
  );
}

export function EventInspector({ eventId, onClose }: { eventId: string; onClose(): void }) {
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previousFocus.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setError('');
    apiRequest<{ event: EventDetail }>(`/v1/events/${eventId}`)
      .then((response) => {
        if (cancelled) return;
        setDetail(response.event);
        setSelectedAttempt(response.event.attempts.length - 1);
      })
      .catch((requestError) => {
        if (!cancelled) setError(readableError(requestError));
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  const attempt = detail?.attempts[selectedAttempt] ?? null;
  const headerEntries = attempt ? Object.entries(attempt.headers ?? {}) : [];
  const hasRedactions = headerEntries.some(([, value]) => isRedacted(value));

  return (
    <div className="ht-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        ref={dialogRef}
        className="ht-inspector"
        role="dialog"
        aria-modal="true"
        aria-label="Event inspector"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="ht-inspector-head">
          <div>
            <p className="ht-kicker">Event inspector</p>
            <h2>{detail?.correlationKey ?? '…'}</h2>
          </div>
          <button type="button" className="ht-close" aria-label="Close inspector" onClick={onClose}>
            ×
          </button>
        </header>

        {error ? (
          <div className="ht-inspector-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="button secondary"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              Retry
            </button>
          </div>
        ) : !detail ? (
          <div className="ht-inspector-loading" aria-label="Loading event">
            <div className="ht-skeleton" />
            <div className="ht-skeleton" />
            <div className="ht-skeleton tall" />
          </div>
        ) : (
          <div className="ht-inspector-body">
            <dl className="ht-inspector-meta">
              <div>
                <dt>Body hash</dt>
                <dd>
                  <code title={detail.bodyHash}>{shortHash(detail.bodyHash, 16)}</code>
                </dd>
              </div>
              <div>
                <dt>Attempts</dt>
                <dd>{detail.attempts.length}</dd>
              </div>
            </dl>

            {detail.report ? (
              <section className="ht-report-card" aria-label="Resilience report">
                <header>
                  <span>Resilience score</span>
                  <b className={detail.report.status === 'completed' ? 'ok' : ''}>
                    {detail.report.status.toUpperCase()}
                  </b>
                </header>
                <strong className="ht-score-value">
                  {detail.report.score ?? '—'}
                  <small>/100</small>
                </strong>
                <ReportResult result={detail.report.result} />
              </section>
            ) : (
              <p className="ht-report-pending">Report pending — it is generated in background.</p>
            )}

            <nav className="ht-attempt-nav" aria-label="Attempts">
              {detail.attempts.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={index === selectedAttempt ? 'active' : ''}
                  aria-current={index === selectedAttempt}
                  onClick={() => setSelectedAttempt(index)}
                >
                  {String(item.sequence).padStart(2, '0')}
                  <code className={statusTone(item.responseStatus)}>{item.responseStatus}</code>
                </button>
              ))}
            </nav>

            {attempt ? (
              <section className="ht-attempt" aria-label={`Attempt ${attempt.sequence}`}>
                <div className="ht-request-line">
                  <code>
                    <b>{attempt.method}</b> {attempt.path}
                  </code>
                  <span>{shortDate(attempt.receivedAt)}</span>
                </div>
                <dl className="ht-attempt-facts">
                  <div>
                    <dt>Received</dt>
                    <dd>{clockTime(attempt.receivedAt)}</dd>
                  </div>
                  <div>
                    <dt>Responded</dt>
                    <dd>
                      <code className={statusTone(attempt.responseStatus)}>
                        {attempt.responseStatus}
                      </code>
                    </dd>
                  </div>
                  <div>
                    <dt>Response delay</dt>
                    <dd>{attempt.responseDelayMs} ms</dd>
                  </div>
                </dl>

                <h3>Headers</h3>
                {headerEntries.length === 0 ? (
                  <p className="ht-muted-line">No headers captured.</p>
                ) : (
                  <table className="ht-headers">
                    <tbody>
                      {headerEntries.map(([key, value]) => (
                        <tr key={key}>
                          <th scope="row">{key}</th>
                          <td className={isRedacted(value) ? 'redacted' : ''}>{String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {hasRedactions ? (
                  <p className="ht-muted-line">
                    Sensitive headers are redacted before reaching the browser.
                  </p>
                ) : null}

                <h3>Body</h3>
                <BodyViewer attempt={attempt} />
              </section>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
