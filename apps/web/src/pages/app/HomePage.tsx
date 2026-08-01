import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BellRing,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  Gauge,
  RadioTower,
  Radar,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { ProductState } from '../../components/ui/ProductState';
import { PageHeader } from '../../components/ui/PageHeader';
import { MetricCard } from '../../components/ui/MetricCard';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type {
  IntegrationSummary,
  MonitorSummary,
  OperationsResponse,
  ReliabilitySummary,
} from '../../lib/types';

const HomeTelemetry = lazy(() =>
  import('../../components/app/HomeTelemetry').then((module) => ({
    default: module.HomeTelemetry,
  })),
);

interface HomeData {
  operations: OperationsResponse | null;
  monitors: MonitorSummary[];
  routes: IntegrationSummary[];
  reliability: ReliabilitySummary | null;
}

type HealthTone = 'new' | 'healthy' | 'degraded' | 'down';

interface PriorityItem {
  title: string;
  detail: string;
  href: string;
  tone: HealthTone;
  icon: typeof CircleAlert;
  endpointId?: string;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: HealthTone;
  href: string;
  endpointId?: string;
}

function toneLabel(tone: HealthTone): string {
  if (tone === 'down') return 'Needs attention';
  if (tone === 'degraded') return 'Watch closely';
  if (tone === 'healthy') return 'Healthy';
  return 'Not configured';
}

function routeState(route: IntegrationSummary): HealthTone {
  if (route.state === 'down' || route.incident?.status === 'open') return 'down';
  if (route.state === 'degraded') return 'degraded';
  return 'healthy';
}

function monitorState(monitor: MonitorSummary): HealthTone {
  if (monitor.state === 'down' || monitor.incident?.status === 'open') return 'down';
  if (monitor.state === 'degraded' || monitor.state === 'paused') return 'degraded';
  if (monitor.state === 'new') return 'new';
  return 'healthy';
}

export function HomePage() {
  const { endpoints, loading: workspaceLoading, selectEndpoint } = useDashboard();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      apiRequest<OperationsResponse>('/v1/operations'),
      apiRequest<{ monitors: MonitorSummary[] }>('/v1/monitors'),
      apiRequest<{ integrations: IntegrationSummary[] }>('/v1/integrations'),
      apiRequest<ReliabilitySummary>('/v1/reliability/summary?windowDays=1'),
    ]);
    const [operations, monitors, routes, reliability] = results;
    const next: HomeData = {
      operations: operations.status === 'fulfilled' ? operations.value : null,
      monitors: monitors.status === 'fulfilled' ? monitors.value.monitors : [],
      routes: routes.status === 'fulfilled' ? routes.value.integrations : [],
      reliability: reliability.status === 'fulfilled' ? reliability.value : null,
    };
    if (results.every((result) => result.status === 'rejected')) {
      throw new Error('The workspace overview could not load.');
    }
    setData(next);
    setError('');
  }, []);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((cause) => setError(readableError(cause)))
      .finally(() => setLoading(false));
    const timer = window.setInterval(
      () => void load().catch((cause) => setError(readableError(cause))),
      15_000,
    );
    return () => window.clearInterval(timer);
  }, [load]);

  const liveEndpoints = useMemo(
    () => endpoints.filter((endpoint) => endpoint.mode !== 'trial' && !endpoint.demoOwned),
    [endpoints],
  );
  const trialEndpoints = useMemo(
    () => endpoints.filter((endpoint) => endpoint.mode === 'trial' && !endpoint.demoOwned),
    [endpoints],
  );
  const operations = data?.operations;
  const routes = data?.routes ?? [];
  const monitors = data?.monitors ?? [];
  const openIncidents = operations?.summary.openIncidents ?? 0;
  const unresolvedDeadLetters = operations?.summary.unresolvedDeadLetters ?? 0;
  const unhealthyResources = [...routes, ...monitors].filter((resource) => {
    const state = 'state' in resource ? resource.state : 'healthy';
    return state === 'down' || state === 'degraded';
  }).length;
  const health: HealthTone =
    openIncidents || unhealthyResources
      ? routes.some((route) => routeState(route) === 'down') ||
        monitors.some((monitor) => monitorState(monitor) === 'down')
        ? 'down'
        : 'degraded'
      : routes.length || monitors.length
        ? 'healthy'
        : 'new';

  const priorities = useMemo<PriorityItem[]>(() => {
    const items: PriorityItem[] = [];
    const firstIncident = operations?.incidents.find((incident) => incident.status === 'open');
    if (firstIncident) {
      items.push({
        title: `${operations?.summary.openIncidents ?? 0} open incident${operations?.summary.openIncidents === 1 ? '' : 's'}`,
        detail: firstIncident.summary,
        href: '/app/operations',
        tone: 'down',
        icon: CircleAlert,
      });
    }
    if (unresolvedDeadLetters > 0) {
      items.push({
        title: `${unresolvedDeadLetters} delivery${unresolvedDeadLetters === 1 ? '' : 'ies'} waiting`,
        detail: 'Review the recovery queue before replaying or retrying.',
        href: '/app/operations',
        tone: 'down',
        icon: TriangleAlert,
      });
    }
    const unhealthyRoute = routes.find((route) => routeState(route) !== 'healthy');
    if (unhealthyRoute) {
      items.push({
        title: `${unhealthyRoute.name} needs attention`,
        detail: `${unhealthyRoute.mode.toUpperCase()} route · ${toneLabel(routeState(unhealthyRoute))}`,
        href: `/app/control-center/${unhealthyRoute.endpointId}`,
        endpointId: unhealthyRoute.endpointId,
        tone: routeState(unhealthyRoute),
        icon: RadioTower,
      });
    }
    const unhealthyMonitor = monitors.find((monitor) => monitorState(monitor) !== 'healthy');
    if (unhealthyMonitor) {
      items.push({
        title: `${unhealthyMonitor.name} needs attention`,
        detail: `${unhealthyMonitor.protocol.toUpperCase()} check · ${toneLabel(monitorState(unhealthyMonitor))}`,
        href: '/app/monitor',
        tone: monitorState(unhealthyMonitor),
        icon: Radar,
      });
    }
    if (!liveEndpoints.length) {
      items.push({
        title: 'Connect your first live route',
        detail: 'Put HookTrials between a provider and your backend.',
        href: '/app/live-webhooks',
        tone: 'new',
        icon: RadioTower,
      });
    }
    if (!monitors.length) {
      items.push({
        title: 'Add a dependency monitor',
        detail: 'Establish availability and latency evidence for one service.',
        href: '/app/monitor',
        tone: 'new',
        icon: Radar,
      });
    }
    if (!trialEndpoints.length) {
      items.push({
        title: 'Run a safe failure trial',
        detail: 'Prove a retry path with synthetic traffic before production.',
        href: '/app/endpoints',
        tone: 'new',
        icon: FlaskConical,
      });
    }
    return items.slice(0, 4);
  }, [
    liveEndpoints.length,
    monitors,
    operations,
    routes,
    trialEndpoints.length,
    unresolvedDeadLetters,
  ]);

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    for (const route of routes) {
      const latest = route.latestDelivery;
      if (!latest) continue;
      items.push({
        id: `delivery-${latest.id}`,
        title: `${route.name} delivery ${latest.state}`,
        detail: `${route.mode.toUpperCase()} · attempt ${latest.sequence}`,
        timestamp: latest.completedAt ?? latest.createdAt,
        tone:
          latest.state === 'succeeded'
            ? 'healthy'
            : latest.state === 'dead_letter'
              ? 'down'
              : 'degraded',
        href: `/app/control-center/${route.endpointId}`,
        endpointId: route.endpointId,
      });
    }
    for (const monitor of monitors) {
      const latest = monitor.metrics.latest;
      if (!latest) continue;
      items.push({
        id: `monitor-${monitor.id}-${latest.startedAt}`,
        title: `${monitor.name} check ${latest.outcome}`,
        detail: `${monitor.protocol.toUpperCase()} · ${latest.latencyMs === null ? 'no latency' : `${latest.latencyMs} ms`}`,
        timestamp: latest.startedAt,
        tone:
          latest.outcome === 'healthy'
            ? 'healthy'
            : latest.outcome === 'down'
              ? 'down'
              : 'degraded',
        href: '/app/monitor',
      });
    }
    for (const incident of operations?.incidents ?? []) {
      items.push({
        id: `incident-${incident.id}`,
        title: incident.status === 'open' ? 'Incident opened' : 'Incident recovered',
        detail: incident.summary,
        timestamp: incident.recoveredAt ?? incident.openedAt,
        tone: incident.status === 'open' ? 'down' : 'healthy',
        href: '/app/operations',
      });
    }
    return items
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, 6);
  }, [monitors, operations, routes]);

  const healthCopy = {
    new: {
      eyebrow: 'WORKSPACE PULSE',
      title: 'Start by proving one path.',
      detail:
        'Your workspace is ready. Create a safe Trial, connect a live route or add a monitor to establish the first evidence.',
      action: '/app/demo',
      actionLabel: 'Run guided demo',
    },
    healthy: {
      eyebrow: 'WORKSPACE PULSE',
      title: 'Your reliability surface is healthy.',
      detail:
        'Routes and monitored dependencies are within their configured boundaries. Keep the recovery evidence close as integrations change.',
      action: '/app/reliability',
      actionLabel: 'Review reliability',
    },
    degraded: {
      eyebrow: 'WORKSPACE PULSE',
      title: 'Some signals need a closer look.',
      detail:
        'There is degraded evidence or an unresolved operational item. Start with the highest-impact action below.',
      action: '/app/operations',
      actionLabel: 'Open operations',
    },
    down: {
      eyebrow: 'WORKSPACE PULSE',
      title: 'Reliability needs attention now.',
      detail:
        'An active incident, failed route or unavailable dependency is affecting the workspace. Triage it before making configuration changes.',
      action: '/app/operations',
      actionLabel: 'Triage incident',
    },
  }[health];

  function openPriority(item: PriorityItem | ActivityItem) {
    if (item.endpointId) selectEndpoint(item.endpointId);
  }

  return (
    <section className="ht-page ht-home" data-tour-section="home" data-product-area="product">
      <PageHeader
        eyebrow="WORKSPACE OVERVIEW"
        title="Home"
        description="See what is running, what needs attention and where to go next."
        actions={
          <>
            <button
              type="button"
              className="button secondary compact"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw aria-hidden="true" /> {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link className="button primary compact" to="/app/live-webhooks">
              Connect a route <ArrowRight aria-hidden="true" />
            </Link>
          </>
        }
      />

      {error && data ? (
        <ProductState
          compact
          tone="danger"
          eyebrow="Partial refresh"
          title="Some workspace signals could not refresh."
          description={error}
          action={
            <button className="button secondary compact" type="button" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : null}

      {loading || workspaceLoading ? (
        <div className="ht-skeleton tall" aria-label="Loading workspace overview" />
      ) : !data && error ? (
        <ProductState
          tone="danger"
          eyebrow="Workspace unavailable"
          title="The Home overview could not load."
          description={error}
          action={
            <button className="button primary" type="button" onClick={() => void load()}>
              Try again
            </button>
          }
        />
      ) : (
        <>
          <section className={`ht-home-pulse ${health}`} aria-label="Workspace status">
            <div className="ht-home-pulse-icon" aria-hidden="true">
              {health === 'down' ? (
                <CircleAlert />
              ) : health === 'degraded' ? (
                <TriangleAlert />
              ) : health === 'healthy' ? (
                <CheckCircle2 />
              ) : (
                <Gauge />
              )}
            </div>
            <div>
              <p className="ht-kicker">{healthCopy.eyebrow}</p>
              <h2>{healthCopy.title}</h2>
              <p>{healthCopy.detail}</p>
            </div>
            <Link className="button secondary compact" to={healthCopy.action}>
              {healthCopy.actionLabel} <ArrowRight aria-hidden="true" />
            </Link>
          </section>

          <section className="ht-home-metrics" aria-label="Workspace metrics">
            <MetricCard
              label="Live routes"
              value={liveEndpoints.length}
              detail="Webhook Hub"
              icon={RadioTower}
              tone={liveEndpoints.length ? 'healthy' : 'neutral'}
            />
            <MetricCard
              label="Trial endpoints"
              value={trialEndpoints.length}
              detail="Safe synthetic paths"
              icon={FlaskConical}
            />
            <MetricCard
              label="Monitors"
              value={monitors.length}
              detail={`${data?.reliability?.aggregate.checks ?? 0} checks in 24h`}
              icon={Radar}
              tone={monitors.length ? 'healthy' : 'neutral'}
            />
            <MetricCard
              label="Open incidents"
              value={openIncidents}
              detail={`${unresolvedDeadLetters} unresolved deliveries`}
              icon={CircleAlert}
              tone={openIncidents ? 'danger' : 'healthy'}
            />
            <MetricCard
              label="Recoveries 24h"
              value={operations?.summary.protectedRecoveries24h ?? 0}
              detail="Protected delivery paths"
              icon={ShieldCheck}
              tone="healthy"
            />
          </section>

          <Suspense fallback={<div className="ht-home-telemetry-loading" aria-hidden="true" />}>
            <HomeTelemetry
              routes={routes}
              monitors={monitors}
              operations={operations}
              reliability={data?.reliability}
            />
          </Suspense>

          <div className="ht-home-grid">
            <section
              className="ht-home-panel ht-home-priorities"
              aria-labelledby="home-priority-title"
            >
              <header>
                <div>
                  <p className="ht-kicker">NEXT ACTIONS</p>
                  <h2 id="home-priority-title">What needs your attention</h2>
                </div>
                <ShieldCheck aria-hidden="true" />
              </header>
              {priorities.length ? (
                <div className="ht-home-priority-list">
                  {priorities.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={`${item.title}-${item.href}`}
                        className={`ht-home-priority ${item.tone}`}
                        to={item.href}
                        onClick={() => openPriority(item)}
                      >
                        <Icon aria-hidden="true" />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="ht-home-empty">
                  <CheckCircle2 aria-hidden="true" />
                  <p>No urgent actions. Your current evidence is within bounds.</p>
                </div>
              )}
            </section>

            <section className="ht-home-panel ht-home-quick" aria-labelledby="home-quick-title">
              <header>
                <div>
                  <p className="ht-kicker">SHORTCUTS</p>
                  <h2 id="home-quick-title">Go straight to the work</h2>
                </div>
                <Activity aria-hidden="true" />
              </header>
              <div className="ht-home-quick-list">
                <Link to="/app/live-webhooks">
                  <RadioTower aria-hidden="true" />
                  <span>
                    <strong>Webhook Hub</strong>
                    <small>Connect real provider traffic</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/app/monitor">
                  <Radar aria-hidden="true" />
                  <span>
                    <strong>Monitoring</strong>
                    <small>Check APIs and dependencies</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/app/endpoints">
                  <FlaskConical aria-hidden="true" />
                  <span>
                    <strong>Trial lab</strong>
                    <small>Prove a deterministic failure path</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/app/operations">
                  <BellRing aria-hidden="true" />
                  <span>
                    <strong>Operations</strong>
                    <small>Recover deliveries and incidents</small>
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>

          <div className="ht-home-grid">
            <section className="ht-home-panel" aria-labelledby="home-routes-title">
              <header>
                <div>
                  <p className="ht-kicker">PRODUCT SURFACE</p>
                  <h2 id="home-routes-title">Live routes</h2>
                </div>
                <Link to="/app/live-webhooks">View all</Link>
              </header>
              {routes.length ? (
                <div className="ht-home-resource-list">
                  {routes.slice(0, 5).map((route) => {
                    const tone = routeState(route);
                    return (
                      <Link
                        key={route.id}
                        to={`/app/control-center/${route.endpointId}`}
                        onClick={() => selectEndpoint(route.endpointId)}
                      >
                        <span className={`ht-home-status-dot ${tone}`} aria-hidden="true" />
                        <span>
                          <strong>{route.name}</strong>
                          <small>
                            {route.mode.toUpperCase()} · {route.environment}
                          </small>
                        </span>
                        <b className={`ht-home-inline-state ${tone}`}>{toneLabel(tone)}</b>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="ht-home-empty">
                  <RadioTower aria-hidden="true" />
                  <p>No live routes yet. Start in Webhook Hub when a provider is ready.</p>
                  <Link className="button secondary compact" to="/app/live-webhooks">
                    Open Webhook Hub
                  </Link>
                </div>
              )}
            </section>

            <section className="ht-home-panel" aria-labelledby="home-monitors-title">
              <header>
                <div>
                  <p className="ht-kicker">DEPENDENCY SURFACE</p>
                  <h2 id="home-monitors-title">Monitors</h2>
                </div>
                <Link to="/app/monitor">View all</Link>
              </header>
              {monitors.length ? (
                <div className="ht-home-resource-list">
                  {monitors.slice(0, 5).map((monitor) => {
                    const tone = monitorState(monitor);
                    return (
                      <Link key={monitor.id} to="/app/monitor">
                        <span className={`ht-home-status-dot ${tone}`} aria-hidden="true" />
                        <span>
                          <strong>{monitor.name}</strong>
                          <small>
                            {monitor.protocol.toUpperCase()} · {monitor.displayHost}
                          </small>
                        </span>
                        <b className={`ht-home-inline-state ${tone}`}>{toneLabel(tone)}</b>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="ht-home-empty">
                  <Radar aria-hidden="true" />
                  <p>No monitors yet. Add one to establish availability evidence.</p>
                  <Link className="button secondary compact" to="/app/monitor">
                    Add a monitor
                  </Link>
                </div>
              )}
            </section>
          </div>

          <section className="ht-home-panel ht-home-activity" aria-labelledby="home-activity-title">
            <header>
              <div>
                <p className="ht-kicker">RECENT EVIDENCE</p>
                <h2 id="home-activity-title">Workspace activity</h2>
              </div>
              <Link to="/app/operations">Open Operations</Link>
            </header>
            {activity.length ? (
              <div className="ht-home-activity-list">
                {activity.map((item) => (
                  <Link key={item.id} to={item.href} onClick={() => openPriority(item)}>
                    <span className={`ht-home-status-dot ${item.tone}`} aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </span>
                    <time dateTime={item.timestamp}>{timeAgo(item.timestamp)}</time>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ht-home-empty">
                <Activity aria-hidden="true" />
                <p>Activity will appear here after a route receives traffic or a monitor runs.</p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
