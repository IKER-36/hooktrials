import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { apiRequest } from '../lib/api';
import { shortDate } from '../lib/format';

interface PublicEvidence {
  integration: { name: string; mode: string; environment: string };
  event: { correlationKey: string; bodyHash: string; firstSeenAt: string; lastSeenAt: string };
  attempts: Array<{
    id: string;
    sequence: number;
    method: string;
    receivedAt: string;
    responseStatus: number;
    signatureProvider: string;
    signatureStatus: string;
    contractResult: { configured?: boolean; passed?: boolean };
  }>;
  deliveries: Array<{
    id: string;
    sequence: number;
    kind: string;
    state: string;
    statusCode: number | null;
    latencyMs: number | null;
    errorCategory: string | null;
  }>;
  report: { status: string; score: number | null; result: unknown };
  expiresAt: string;
  redacted: true;
}

export function EvidencePage() {
  const { token = '' } = useParams();
  const [evidence, setEvidence] = useState<PublicEvidence | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    apiRequest<{ evidence: PublicEvidence }>(`/v1/public/evidence/${token}`)
      .then((response) => setEvidence(response.evidence))
      .catch(() => setMissing(true));
  }, [token]);

  return (
    <main className="ht-public-evidence">
      <header>
        <Brand />
        <span>REDACTED EVIDENCE · READ ONLY</span>
      </header>
      {missing ? (
        <section className="ht-evidence-missing">
          <h1>Evidence link unavailable.</h1>
          <p>It expired, was revoked or never existed.</p>
          <Link to="/">Open HookTrials</Link>
        </section>
      ) : !evidence ? (
        <section>
          <p>Loading verified evidence…</p>
        </section>
      ) : (
        <article>
          <p className="ht-kicker">Integration reliability evidence</p>
          <h1>{evidence.integration.name}</h1>
          <div className="ht-evidence-tags">
            <span>{evidence.integration.mode}</span>
            <span>{evidence.integration.environment}</span>
            <span>expires {shortDate(evidence.expiresAt)}</span>
          </div>
          <section className="ht-evidence-summary">
            <div>
              <span>Event</span>
              <strong>{evidence.event.correlationKey}</strong>
            </div>
            <div>
              <span>Inbound attempts</span>
              <strong>{evidence.attempts.length}</strong>
            </div>
            <div>
              <span>Destination deliveries</span>
              <strong>{evidence.deliveries.length}</strong>
            </div>
            <div>
              <span>Resilience report</span>
              <strong>{evidence.report.score ?? '—'}/100</strong>
            </div>
          </section>
          <section className="ht-evidence-timeline">
            <h2>End-to-end timeline</h2>
            {evidence.attempts.map((attempt) => (
              <div key={attempt.id}>
                <b>
                  INBOUND {String(attempt.sequence).padStart(2, '0')} · HTTP{' '}
                  {attempt.responseStatus}
                </b>
                <span>
                  {attempt.method} · {shortDate(attempt.receivedAt)} · signature{' '}
                  {attempt.signatureStatus} · contract{' '}
                  {attempt.contractResult.configured
                    ? attempt.contractResult.passed
                      ? 'passed'
                      : 'failed'
                    : 'not configured'}
                </span>
              </div>
            ))}
            {evidence.deliveries.map((delivery) => (
              <div key={delivery.id} className={delivery.state === 'succeeded' ? 'ok' : 'failed'}>
                <b>
                  OUTBOUND {String(delivery.sequence).padStart(2, '0')} ·{' '}
                  {delivery.kind.toUpperCase()} · {delivery.state.toUpperCase()}
                </b>
                <span>
                  {delivery.statusCode
                    ? `HTTP ${delivery.statusCode}`
                    : (delivery.errorCategory ?? 'queued')}{' '}
                  · {delivery.latencyMs ?? '—'} ms
                </span>
              </div>
            ))}
          </section>
          <footer>
            <span>
              Payloads, headers, secrets, credentials and destination URLs are intentionally
              excluded.
            </span>
            <Link to="/">Powered by HookTrials</Link>
          </footer>
        </article>
      )}
    </main>
  );
}
