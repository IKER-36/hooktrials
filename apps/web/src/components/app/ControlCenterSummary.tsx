import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import type { IntegrationSummary, MonitorSummary, OperationsResponse } from '../../lib/types';

export function ControlCenterSummary({ scope = 'product' }: { scope?: 'product' | 'demo' }) {
  const [operations, setOperations] = useState<OperationsResponse | null>(null);
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [routes, setRoutes] = useState<IntegrationSummary[]>([]);

  const load = useCallback(async () => {
    const [operationResponse, monitorResponse, integrationResponse] = await Promise.all([
      apiRequest<OperationsResponse>(`/v1/operations?scope=${scope}`),
      apiRequest<{ monitors: MonitorSummary[] }>(`/v1/monitors?scope=${scope}`),
      apiRequest<{ integrations: IntegrationSummary[] }>(`/v1/integrations?scope=${scope}`),
    ]);
    setOperations(operationResponse);
    setMonitors(monitorResponse.monitors);
    setRoutes(integrationResponse.integrations);
  }, [scope]);

  useEffect(() => {
    void load().catch(() => undefined);
    const timer = window.setInterval(() => void load().catch(() => undefined), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const state = useMemo(() => {
    const resources = [...monitors, ...routes];
    const down = resources.filter((resource) => resource.state === 'down').length;
    const degraded = resources.filter((resource) => resource.state === 'degraded').length;
    const healthy = resources.filter((resource) => resource.state === 'healthy').length;
    const open = operations?.summary.openIncidents ?? 0;
    const deadLetters = operations?.summary.unresolvedDeadLetters ?? 0;
    return {
      resources: resources.length,
      healthy,
      status:
        open || down
          ? 'down'
          : degraded || deadLetters
            ? 'degraded'
            : resources.length
              ? 'healthy'
              : 'new',
    };
  }, [monitors, operations, routes]);

  const priority = operations?.incidents.find((incident) => incident.status === 'open');
  return (
    <section className="ht-control-center" aria-label="Workspace reliability summary">
      <header>
        <div>
          <p className="ht-kicker">CURRENT STATE</p>
          <h2>Integration reliability, now</h2>
        </div>
        <span className={`ht-monitor-state ${state.status}`}>{state.status}</span>
      </header>
      <div className="ht-control-metrics">
        <article>
          <span>Resources</span>
          <strong>{state.resources}</strong>
        </article>
        <article>
          <span>Healthy</span>
          <strong>{state.healthy}</strong>
        </article>
        <article>
          <span>Open incidents</span>
          <strong>{operations?.summary.openIncidents ?? '—'}</strong>
        </article>
        <article>
          <span>Unresolved DLQ</span>
          <strong>{operations?.summary.unresolvedDeadLetters ?? '—'}</strong>
        </article>
        <article>
          <span>Recoveries 24h</span>
          <strong>{operations?.summary.protectedRecoveries24h ?? '—'}</strong>
        </article>
      </div>
      <footer>
        <p>
          {priority
            ? priority.summary
            : state.resources
              ? 'No active incident. Latest evidence is within the configured reliability boundaries.'
              : 'Create a Trial route or Monitor resource to establish your first reliability baseline.'}
        </p>
        <div>
          <Link to="/app/monitor">Open inventory</Link>
          <Link to="/app/operations">Open incidents & recovery</Link>
        </div>
      </footer>
    </section>
  );
}
