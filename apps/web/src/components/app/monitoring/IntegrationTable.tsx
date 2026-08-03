import { STATE_LABEL } from './shared';
import type { IntegrationSummary, MonitorSummary } from '../../../lib/types';

export function IntegrationTable({
  monitors,
  routes,
  onSelectMonitor,
  onSelectRoute,
}: {
  monitors: MonitorSummary[];
  routes: IntegrationSummary[];
  onSelectMonitor(id: string): void;
  onSelectRoute(id: string): void;
}) {
  if (monitors.length === 0 && routes.length === 0) return null;
  return (
    <section
      id="integration-inventory"
      className="ht-integration-table"
      aria-label="All integrations"
    >
      <header>
        <div>
          <h2>All integrations</h2>
        </div>
        <span>Active checks + real webhook traffic</span>
      </header>
      <div className="ht-integration-table-head" aria-hidden="true">
        <span>Integration</span>
        <span>Type</span>
        <span>Environment</span>
        <span>Mode</span>
        <span>Status</span>
        <span>Score</span>
        <span>Latency</span>
        <span>Latest issue</span>
        <span>Open</span>
      </div>
      {routes.map((route) => (
        <button
          key={route.id}
          type="button"
          className="ht-integration-row"
          onClick={() => onSelectRoute(route.endpointId)}
          aria-label={`Open ${route.name} delivery timeline`}
        >
          <strong>{route.name}</strong>
          {/* Destination carried over from the removed duplicate route list. */}
          <span>webhook → {route.destinationHost ?? 'no destination'}</span>
          <span>{route.environment}</span>
          <span>{route.mode}</span>
          <span className={`ht-monitor-state ${route.state}`}>{STATE_LABEL[route.state]}</span>
          <b>{route.score.score}/100</b>
          <code>{route.latestDelivery?.latencyMs ?? '—'} ms</code>
          <small>{route.incident?.cause ?? route.latestDelivery?.errorCategory ?? 'None'}</small>
          <span className="ht-table-action" aria-hidden="true">
            Open →
          </span>
        </button>
      ))}
      {monitors.map((monitor) => (
        <button
          key={monitor.id}
          type="button"
          className="ht-integration-row"
          onClick={() => onSelectMonitor(monitor.id)}
          aria-label={`Open ${monitor.name} monitor`}
        >
          <strong>{monitor.name}</strong>
          <span>{monitor.resourceType.replaceAll('_', ' ')}</span>
          <span>{monitor.environment}</span>
          <span>monitor</span>
          <span className={`ht-monitor-state ${monitor.state}`}>{STATE_LABEL[monitor.state]}</span>
          <b>{monitor.score.score}/100</b>
          <code>{monitor.metrics.latest?.latencyMs ?? '—'} ms</code>
          <small>
            {monitor.incident?.cause ?? monitor.metrics.latest?.errorCategory ?? 'None'}
          </small>
          <span className="ht-table-action" aria-hidden="true">
            Open →
          </span>
        </button>
      ))}
    </section>
  );
}
