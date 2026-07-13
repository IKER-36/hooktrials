import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AttemptSequence, OutcomeBadge } from '../../components/app/AttemptSequence';
import { EventInspector } from '../../components/app/EventInspector';
import { CopyButton } from '../../components/ui/CopyButton';
import { useDashboard } from '../../layouts/AppLayout';
import { useEventStream } from '../../hooks/useEventStream';
import type { StreamStatus } from '../../hooks/useEventStream';
import { apiRequest } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { EventSummary } from '../../lib/types';

const STREAM_LABEL: Record<StreamStatus, string> = {
  idle: 'STREAM OFF',
  connecting: 'CONNECTING',
  live: 'LIVE',
  reconnecting: 'RECONNECTING',
};

function curlSnippet(url: string): string {
  return [
    `curl -X POST '${url}' \\`,
    `  -H 'content-type: application/json' \\`,
    `  -d '{"event":"synthetic.test","id":"demo-001"}'`,
  ].join('\n');
}

export function OverviewPage() {
  const { endpoints, selected, selectEndpoint, toggleEndpoint, loading, reportError } =
    useDashboard();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const freshIds = useRef<Set<string>>(new Set());
  const knownActivity = useRef<Map<string, string>>(new Map());

  const loadEvents = useCallback(async (endpointId: string) => {
    const response = await apiRequest<{ events: EventSummary[] }>(
      `/v1/endpoints/${endpointId}/events`,
    );
    const fresh = new Set<string>();
    for (const event of response.events) {
      const previous = knownActivity.current.get(event.id);
      if (previous && previous !== event.lastSeenAt) fresh.add(event.id);
      knownActivity.current.set(event.id, event.lastSeenAt);
    }
    freshIds.current = fresh;
    setEvents(response.events);
  }, []);

  useEffect(() => {
    knownActivity.current.clear();
    freshIds.current.clear();
    if (!selected) {
      setEvents([]);
      return;
    }
    setEventsLoading(true);
    loadEvents(selected.id)
      .catch(reportError)
      .finally(() => setEventsLoading(false));
  }, [selected, loadEvents, reportError]);

  const streamStatus = useEventStream(
    selected?.id ?? null,
    useCallback(() => {
      if (selected) void loadEvents(selected.id).catch(reportError);
    }, [selected, loadEvents, reportError]),
  );

  const totalAttempts = useMemo(
    () => events.reduce((total, event) => total + event.attempts.length, 0),
    [events],
  );

  async function togglePause() {
    if (!selected) return;
    setToggling(true);
    try {
      await toggleEndpoint(selected);
    } catch (error) {
      reportError(error);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <section className="ht-page" aria-label="Loading">
        <div className="ht-skeleton wide" />
        <div className="ht-skeleton tall" />
      </section>
    );
  }

  if (!selected) {
    return (
      <section className="ht-page">
        <header className="ht-page-head">
          <div>
            <p className="ht-kicker">Overview</p>
            <h1>Your webhook lab</h1>
          </div>
        </header>
        <div className="ht-onboarding">
          <img src="/brand/hooklogo-transparent.png" alt="" width="56" height="56" />
          <h2>Run your first trial</h2>
          <ol>
            <li>Create a trial endpoint.</li>
            <li>Choose a deterministic failure scenario.</li>
            <li>Copy the generated webhook URL.</li>
            <li>Point a provider at it — or send a test curl.</li>
            <li>Watch the retries unfold here, live.</li>
          </ol>
          <Link className="button primary" to="/app/endpoints">
            Create your first endpoint
          </Link>
          <p className="ht-muted-line">Use synthetic payloads whenever possible.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="ht-page">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Overview</p>
          <h1>{selected.name}</h1>
        </div>
        <div className="ht-page-head-actions">
          {endpoints.length > 1 ? (
            <label className="ht-switcher">
              <span className="sr-only">Active endpoint</span>
              <select value={selected.id} onChange={(event) => selectEndpoint(event.target.value)}>
                {endpoints.map((endpoint) => (
                  <option key={endpoint.id} value={endpoint.id}>
                    {endpoint.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link className="button secondary compact" to="/app/endpoints">
            Manage endpoints
          </Link>
        </div>
      </header>

      <section className="ht-endpoint-card" aria-label="Active endpoint">
        <div className="ht-endpoint-state">
          <span className={`ht-listen ${selected.active ? 'on' : 'off'}`}>
            <i aria-hidden="true" />
            {selected.active ? 'LISTENING' : 'PAUSED'}
          </span>
          <span className="ht-scenario-label">
            scenario: <b>{selected.scenarioName ?? 'Basic inspection'}</b>
          </span>
          <button
            type="button"
            className="button secondary compact"
            onClick={() => void togglePause()}
            disabled={toggling}
          >
            {toggling ? 'Working…' : selected.active ? 'Pause' : 'Resume'}
          </button>
        </div>

        {selected.ingestUrl ? (
          <>
            <div className="ht-url-row">
              <code className="ht-url">{selected.ingestUrl}</code>
              <CopyButton
                value={selected.ingestUrl}
                label="Copy URL"
                className="button primary compact"
              />
            </div>
            <details className="ht-curl">
              <summary>Send a test delivery with curl</summary>
              <div className="ht-curl-body">
                <pre>{curlSnippet(selected.ingestUrl)}</pre>
                <CopyButton value={curlSnippet(selected.ingestUrl)} label="Copy curl" />
              </div>
            </details>
          </>
        ) : (
          <p className="ht-muted-line">
            Ingest URL unavailable — token prefix {selected.tokenPrefix}…
          </p>
        )}
      </section>

      <section className="ht-metrics" aria-label="Endpoint metrics">
        <article>
          <span>Events retained</span>
          <strong>{events.length}</strong>
        </article>
        <article>
          <span>Attempts observed</span>
          <strong>{totalAttempts}</strong>
        </article>
        <article>
          <span>Retention</span>
          <strong>72h</strong>
        </article>
      </section>

      <section className="ht-events" aria-label="Retry timelines">
        <header>
          <div>
            <p className="ht-kicker">Real-time</p>
            <h2>Retry timelines</h2>
          </div>
          <span className={`ht-stream ${streamStatus}`}>
            <i aria-hidden="true" />
            {STREAM_LABEL[streamStatus]}
          </span>
        </header>

        {eventsLoading ? (
          <div className="ht-skeleton tall" aria-label="Loading events" />
        ) : events.length === 0 ? (
          <div className="ht-events-empty">
            <h3>Waiting for the first delivery.</h3>
            <p>
              Send a request to the URL above — or run the curl example. New attempts appear here
              automatically{selected.active ? '' : ' once the endpoint is resumed'}.
            </p>
          </div>
        ) : (
          <ul className="ht-event-list">
            {events.map((event) => (
              <li key={event.id} className={freshIds.current.has(event.id) ? 'fresh' : ''}>
                <button
                  type="button"
                  className="ht-event-row"
                  onClick={() => setInspecting(event.id)}
                >
                  <span className="ht-event-meta">
                    <strong>{event.correlationKey}</strong>
                    <small>{timeAgo(event.lastSeenAt)}</small>
                  </span>
                  <AttemptSequence attempts={event.attempts} />
                  <span className="ht-event-tail">
                    <OutcomeBadge attempts={event.attempts} />
                    <span className="ht-inspect-hint" aria-hidden="true">
                      inspect →
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {inspecting ? (
        <EventInspector eventId={inspecting} onClose={() => setInspecting(null)} />
      ) : null}
    </section>
  );
}
