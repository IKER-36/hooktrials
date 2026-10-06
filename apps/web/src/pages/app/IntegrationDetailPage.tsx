import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  Pause,
  Play,
  RadioTower,
  RotateCcw,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AttemptSequence, OutcomeBadge } from '../../components/app/AttemptSequence';
import { EventInspector } from '../../components/app/EventInspector';
import { ProviderKit } from '../../components/app/ProviderKit';
import { CopyButton } from '../../components/ui/CopyButton';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProductState } from '../../components/ui/ProductState';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type {
  Endpoint,
  EventSummary,
  IntegrationSummary,
  OperationsResponse,
} from '../../lib/types';

const PROVIDER_NAMES: Record<string, string> = {
  generic: 'Generic webhook',
  stripe: 'Stripe',
  github: 'GitHub',
  shopify: 'Shopify',
  slack: 'Slack',
  gitlab: 'GitLab',
  linear: 'Linear',
  hubspot: 'HubSpot',
};

function stateLabel(state: IntegrationSummary['state'] | Endpoint['mode']) {
  if (state === 'healthy') return 'Healthy';
  if (state === 'degraded') return 'Needs attention';
  if (state === 'down') return 'Down';
  if (state === 'paused') return 'Paused';
  if (state === 'protect') return 'Protect';
  if (state === 'observe') return 'Observe';
  return 'No traffic yet';
}

function stateIcon(state: IntegrationSummary['state']) {
  if (state === 'healthy') return CheckCircle2;
  if (state === 'down' || state === 'degraded') return CircleAlert;
  if (state === 'paused') return Pause;
  return Activity;
}

export function IntegrationDetailPage() {
  const navigate = useNavigate();
  const { endpointId } = useParams<{ endpointId: string }>();
  const {
    endpoints,
    loading: dashboardLoading,
    toggleEndpoint,
    selectEndpoint,
    reportError,
  } = useDashboard();
  const endpoint = endpoints.find((item) => item.id === endpointId) ?? null;
  const [integration, setIntegration] = useState<IntegrationSummary | null>(null);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningTest, setRunningTest] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [inspecting, setInspecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!endpointId) return;
    setLoading(true);
    try {
      const [integrationsResponse, eventsResponse, operationsResponse] = await Promise.all([
        apiRequest<{ integrations: IntegrationSummary[] }>('/v1/integrations?scope=product'),
        apiRequest<{ events: EventSummary[] }>(`/v1/endpoints/${endpointId}/events`),
        apiRequest<OperationsResponse>('/v1/operations?scope=product'),
      ]);
      setIntegration(
        integrationsResponse.integrations.find((item) => item.endpointId === endpointId) ?? null,
      );
      setEvents(eventsResponse.events);
      setOperations(operationsResponse);
      setError('');
    } catch (requestError) {
      const message = readableError(requestError);
      setError(message);
      reportError(requestError);
    } finally {
      setLoading(false);
    }
  }, [endpointId, reportError]);

  useEffect(() => {
    void load();
  }, [load]);

  const relatedIncidents = useMemo(
    () => operations?.incidents.filter((incident) => incident.resourceId === integration?.id) ?? [],
    [integration?.id, operations?.incidents],
  );
  const relatedDeadLetters = useMemo(
    () => operations?.deadLetters.filter((delivery) => delivery.endpointId === endpointId) ?? [],
    [endpointId, operations?.deadLetters],
  );
  const StateIcon = integration ? stateIcon(integration.state) : Activity;
  const providerName = PROVIDER_NAMES[endpoint?.provider ?? 'generic'] ?? 'Generic webhook';

  async function runTest() {
    if (!endpoint) return;
    setRunningTest(true);
    try {
      await apiRequest(`/v1/endpoints/${endpoint.id}/test-event`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      await load();
    } catch (requestError) {
      reportError(requestError);
    } finally {
      setRunningTest(false);
    }
  }

  async function toggle() {
    if (!endpoint) return;
    setToggling(true);
    try {
      await toggleEndpoint(endpoint);
      await load();
    } catch (requestError) {
      reportError(requestError);
    } finally {
      setToggling(false);
    }
  }

  function openTimeline() {
    if (!endpoint) return;
    selectEndpoint(endpoint.id);
    navigate(`/app/control-center/${endpoint.id}`);
  }

  if (dashboardLoading || loading) {
    return (
      <section className="ht-page" aria-label="Loading integration">
        <div className="ht-skeleton wide" />
        <div className="ht-skeleton tall" />
      </section>
    );
  }

  if (!endpoint || endpoint.demoOwned || endpoint.mode === 'trial') {
    return (
      <section className="ht-page">
        <PageHeader
          eyebrow="BUILD / INTEGRATION"
          title="Integration not found"
          description="Choose an active live integration from the Webhook Hub."
        />
        <ProductState
          title="Open the Webhook Hub"
          description="Test Lab routes use the Delivery timeline. Live routes have a dedicated integration cockpit."
          action={
            <Link className="button primary" to="/app/live-webhooks">
              Open integrations
            </Link>
          }
        />
      </section>
    );
  }

  if (error && !integration) {
    return (
      <section className="ht-page">
        <PageHeader eyebrow="BUILD / INTEGRATION" title={endpoint.name} description={error} />
        <ProductState
          tone="danger"
          title="Integration evidence is unavailable"
          description="The route remains untouched. Retry the read when the API is available again."
          action={
            <button className="button primary" type="button" onClick={() => void load()}>
              Retry
            </button>
          }
        />
      </section>
    );
  }

  const state = integration?.state ?? (endpoint.active ? 'new' : 'paused');
  const latest = integration?.latestDelivery;
  const readiness = integration?.readiness;

  return (
    <section className="ht-page ht-integration-cockpit" data-product-area="build">
      <PageHeader
        eyebrow="BUILD / INTEGRATION COCKPIT"
        title={endpoint.name}
        description={`${providerName} → HookTrials → ${endpoint.destinationHost ?? 'destination'}. One place for configuration, traffic and recovery evidence.`}
        actions={
          <div className="ht-page-head-actions">
            <Link className="button secondary compact" to="/app/live-webhooks">
              <ArrowLeft aria-hidden="true" /> All integrations
            </Link>
            <button className="button secondary compact" type="button" onClick={() => void load()}>
              <RotateCcw aria-hidden="true" /> Refresh
            </button>
          </div>
        }
      />

      <section className="ht-cockpit-hero" aria-label="Integration status">
        <div className={`ht-cockpit-state ${state}`}>
          <StateIcon aria-hidden="true" />
          <div>
            <span>{stateLabel(state)}</span>
            <small>
              {endpoint.environment} ·{' '}
              {state === 'new' ? 'Waiting for first traffic' : 'Evidence is live'}
            </small>
          </div>
        </div>
        <div className="ht-cockpit-actions">
          <button
            className="button primary compact"
            type="button"
            onClick={() => void runTest()}
            disabled={runningTest}
          >
            <Play aria-hidden="true" /> {runningTest ? 'Sending…' : 'Send test event'}
          </button>
          <button
            className="button secondary compact"
            type="button"
            onClick={() => void toggle()}
            disabled={toggling}
          >
            {endpoint.active ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {endpoint.active ? 'Pause route' : 'Resume route'}
          </button>
          <button className="button secondary compact" type="button" onClick={openTimeline}>
            Open delivery timeline <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="ht-cockpit-grid">
        <article className="ht-cockpit-panel ht-cockpit-route">
          <header>
            <div>
              <p className="ht-kicker">ROUTE</p>
              <h2>How traffic moves</h2>
            </div>
            <Waypoints aria-hidden="true" />
          </header>
          <div className="ht-cockpit-flow">
            <div>
              <RadioTower aria-hidden="true" />
              <b>{providerName}</b>
              <small>Provider</small>
            </div>
            <ArrowRight aria-hidden="true" />
            <div className="active">
              <Waypoints aria-hidden="true" />
              <b>HookTrials</b>
              <small>{stateLabel(endpoint.mode)}</small>
            </div>
            <ArrowRight aria-hidden="true" />
            <div>
              <ExternalLink aria-hidden="true" />
              <b>{endpoint.destinationHost ?? 'Destination'}</b>
              <small>Backend</small>
            </div>
          </div>
          <div className="ht-cockpit-url">
            <span>Public ingestion URL</span>
            {endpoint.ingestUrl ? (
              <>
                <code>{endpoint.ingestUrl}</code>
                <CopyButton value={endpoint.ingestUrl} label="Copy URL" />
              </>
            ) : (
              <small>Unavailable</small>
            )}
          </div>
        </article>

        <article className="ht-cockpit-panel ht-cockpit-readiness">
          <header>
            <div>
              <p className="ht-kicker">READINESS</p>
              <h2>
                {readiness?.score ?? 0}
                <small>/100</small>
              </h2>
            </div>
            <ShieldCheck aria-hidden="true" />
          </header>
          <p>Configuration and delivery evidence, not an opaque grade.</p>
          <ul>
            {(readiness?.checks ?? []).slice(0, 5).map((check) => (
              <li key={check.code} className={check.passed ? 'passed' : 'missing'}>
                <span>{check.passed ? '✓' : '−'}</span>
                <b>{check.label}</b>
              </li>
            ))}
          </ul>
          <Link to="/app/reliability">
            Open reliability view <ArrowRight aria-hidden="true" />
          </Link>
        </article>
      </section>

      <section className="ht-cockpit-metrics" aria-label="Recent integration metrics">
        <div>
          <span>Latest delivery</span>
          <strong>
            {latest ? stateLabel(latest.state === 'succeeded' ? 'healthy' : 'degraded') : '—'}
          </strong>
          <small>
            {latest ? timeAgo(latest.completedAt ?? latest.createdAt) : 'No delivery yet'}
          </small>
        </div>
        <div>
          <span>HTTP response</span>
          <strong>{latest?.statusCode ?? '—'}</strong>
          <small>{latest?.latencyMs ? `${latest.latencyMs} ms` : 'Awaiting evidence'}</small>
        </div>
        <div>
          <span>Events captured</span>
          <strong>{events.length}</strong>
          <small>Retained in this workspace</small>
        </div>
        <div>
          <span>Open incidents</span>
          <strong>{relatedIncidents.filter((item) => item.status === 'open').length}</strong>
          <small>{relatedDeadLetters.length} dead letters</small>
        </div>
      </section>

      <section className="ht-cockpit-evidence">
        <header>
          <div>
            <p className="ht-kicker">EVIDENCE</p>
            <h2>Recent traffic and recovery</h2>
          </div>
          <span>
            <Clock3 aria-hidden="true" /> Auto-refresh when you refresh this view
          </span>
        </header>
        {events.length === 0 ? (
          <ProductState
            compact
            title="Waiting for the first event"
            description="Send a safe synthetic event or point your provider at the public URL to start the delivery timeline."
            action={
              <button
                className="button secondary compact"
                type="button"
                onClick={() => void runTest()}
              >
                Send test event
              </button>
            }
          />
        ) : (
          <ul className="ht-cockpit-event-list">
            {events.slice(0, 8).map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => setInspecting(event.id)}>
                  <span>
                    <b>{event.correlationKey}</b>
                    <small>{timeAgo(event.lastSeenAt)}</small>
                  </span>
                  <AttemptSequence attempts={event.attempts} deliveries={event.deliveries} />
                  <OutcomeBadge attempts={event.attempts} deliveries={event.deliveries} />
                  <ArrowRight aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ProviderKit provider={endpoint.provider} ingestUrl={endpoint.ingestUrl} />

      {relatedIncidents.length > 0 || relatedDeadLetters.length > 0 ? (
        <section className="ht-cockpit-operations">
          <header>
            <div>
              <p className="ht-kicker">OPERATIONS</p>
              <h2>Recovery work for this integration</h2>
            </div>
            <Link to="/app/operations">
              Open operations <ArrowRight aria-hidden="true" />
            </Link>
          </header>
          {relatedIncidents.slice(0, 4).map((incident) => (
            <article
              key={incident.id}
              className={incident.status === 'open' ? 'open' : 'recovered'}
            >
              <CircleAlert aria-hidden="true" />
              <div>
                <b>{incident.summary}</b>
                <small>
                  {incident.status} · {timeAgo(incident.openedAt)}
                </small>
              </div>
              <span>{incident.cause}</span>
            </article>
          ))}
          {relatedDeadLetters.slice(0, 4).map((delivery) => (
            <article key={delivery.id} className={delivery.resolved ? 'recovered' : 'open'}>
              <RotateCcw aria-hidden="true" />
              <div>
                <b>{delivery.correlationKey}</b>
                <small>Dead letter · {timeAgo(delivery.createdAt)}</small>
              </div>
              <span>{delivery.resolved ? 'Recovered' : 'Needs replay'}</span>
            </article>
          ))}
        </section>
      ) : null}

      {inspecting ? (
        <EventInspector eventId={inspecting} onClose={() => setInspecting(null)} />
      ) : null}
    </section>
  );
}
