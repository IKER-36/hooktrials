import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { ProductState } from '../../components/ui/ProductState';
import { apiRequest, readableError } from '../../lib/api';
import type { AuditEvent } from '../../lib/types';

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await apiRequest<{ events: AuditEvent[] }>('/v1/audit-events?limit=100');
    setEvents(response.events);
    setError('');
  }, []);

  useEffect(() => {
    void load()
      .catch((cause) => setError(readableError(cause)))
      .finally(() => setLoading(false));
  }, [load]);

  return (
    <section className="ht-page" data-product-area="resources">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">GOVERNANCE</p>
          <h1>Audit history</h1>
          <p className="ht-muted-line">
            A redacted, chronological record of changes and operator actions in this workspace.
          </p>
        </div>
        <div className="ht-page-head-actions">
          <ClipboardList aria-hidden="true" />
          <button className="button secondary compact" type="button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> Refresh
          </button>
        </div>
      </header>

      {error ? (
        <ProductState
          tone="danger"
          eyebrow="Audit history unavailable"
          title="The audit history could not load."
          description={error}
          action={
            <button className="button primary" type="button" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : loading ? (
        <div className="ht-skeleton tall" />
      ) : events.length === 0 ? (
        <ProductState
          eyebrow="No events yet"
          title="Your operational history will appear here."
          description="Changes to routes, monitors, incidents, API keys and recovery actions are recorded without storing payloads or secrets."
        />
      ) : (
        <section className="ht-operation-panel">
          <header>
            <div>
              <h2>Recent actions</h2>
              <p className="ht-muted-line">
                Secrets, payloads and authorization headers are intentionally excluded.
              </p>
            </div>
          </header>
          <div className="ht-operation-list">
            {events.map((event) => (
              <article key={event.id}>
                <div>
                  <h3>{event.action}</h3>
                  <p>
                    {event.entityType}
                    {event.entityId ? ` · ${event.entityId}` : ''}
                  </p>
                </div>
                <strong>{event.statusCode ?? '—'}</strong>
                <span>{event.actorType === 'api_key' ? 'API key' : 'Browser session'}</span>
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
