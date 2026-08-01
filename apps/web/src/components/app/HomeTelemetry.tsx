import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartNoAxesCombined, CircleAlert, Gauge, Radar, ShieldCheck } from 'lucide-react';
import type {
  IntegrationSummary,
  MonitorSummary,
  OperationsResponse,
  ReliabilitySummary,
} from '../../lib/types';

type HealthTone = 'healthy' | 'degraded' | 'down' | 'new';

interface HomeTelemetryProps {
  routes: IntegrationSummary[];
  monitors: MonitorSummary[];
  operations: OperationsResponse | null | undefined;
  reliability: ReliabilitySummary | null | undefined;
}

interface HealthPoint {
  name: string;
  value: number;
  tone: HealthTone;
}

interface CoveragePoint {
  name: string;
  availability: number;
  target: number;
  hasChecks: boolean;
}

const toneColors: Record<HealthTone, string> = {
  healthy: 'var(--ht-green)',
  degraded: 'var(--ht-amber)',
  down: 'var(--ht-red)',
  new: 'var(--ht-faint)',
};

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

function shortLabel(value: string): string {
  return value.length > 17 ? `${value.slice(0, 15)}…` : value;
}

export function HomeTelemetry({ routes, monitors, operations, reliability }: HomeTelemetryProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const healthMix = useMemo<HealthPoint[]>(() => {
    const counts: Record<HealthTone, number> = { healthy: 0, degraded: 0, down: 0, new: 0 };
    routes.forEach((route) => {
      counts[routeState(route)] += 1;
    });
    monitors.forEach((monitor) => {
      counts[monitorState(monitor)] += 1;
    });
    return [
      { name: 'Healthy', value: counts.healthy, tone: 'healthy' as const },
      { name: 'Watch', value: counts.degraded, tone: 'degraded' as const },
      { name: 'Down', value: counts.down, tone: 'down' as const },
      { name: 'New', value: counts.new, tone: 'new' as const },
    ].filter((item) => item.value > 0);
  }, [monitors, routes]);

  const coverage = useMemo<CoveragePoint[]>(() => {
    const summaryById = new Map((reliability?.monitors ?? []).map((item) => [item.id, item]));
    return monitors.slice(0, 8).map((monitor) => {
      const summary = summaryById.get(monitor.id);
      const availability = summary?.metrics.availability;
      return {
        name: shortLabel(monitor.name),
        availability: availability ?? 0,
        target: summary?.target ?? 99,
        hasChecks: (summary?.metrics.checks ?? monitor.metrics.checks24h) > 0,
      };
    });
  }, [monitors, reliability]);

  const totalResources = healthMix.reduce((total, point) => total + point.value, 0);
  const checks = reliability?.aggregate.checks ?? 0;
  const recovered = operations?.summary.protectedRecoveries24h ?? 0;
  const hasCoverage = coverage.some((point) => point.hasChecks);

  return (
    <section className="ht-home-telemetry" aria-label="Workspace telemetry">
      <motion.article
        className="ht-home-chart-panel ht-home-health-chart"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: 'easeOut' }}
      >
        <header>
          <div>
            <p className="ht-kicker">RESOURCE HEALTH</p>
            <h2>Current surface</h2>
            <p>Routes and dependencies grouped by their latest known state.</p>
          </div>
          <ChartNoAxesCombined aria-hidden="true" />
        </header>
        {totalResources > 0 ? (
          <div className="ht-home-health-chart-body">
            <div className="ht-home-donut-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={!reducedMotion}
                  >
                    {healthMix.map((point) => (
                      <Cell key={point.tone} fill={toneColors[point.tone]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      border: '1px solid var(--ht-hairline-bright)',
                      borderRadius: '8px',
                      background: 'var(--ht-surface-2)',
                      color: 'var(--ht-ink)',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="ht-home-donut-center" aria-hidden="true">
                <strong>{totalResources}</strong>
                <span>resources</span>
              </div>
            </div>
            <ul className="ht-home-chart-legend">
              {healthMix.map((point) => (
                <li key={point.tone}>
                  <span style={{ background: toneColors[point.tone] }} aria-hidden="true" />
                  <span>{point.name}</span>
                  <strong>{point.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="ht-home-chart-empty">
            <ShieldCheck aria-hidden="true" />
            <p>Connect a route or add a monitor to see the workspace surface here.</p>
          </div>
        )}
      </motion.article>

      <motion.article
        className="ht-home-chart-panel ht-home-coverage-chart"
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reducedMotion ? { duration: 0 } : { duration: 0.22, delay: 0.05, ease: 'easeOut' }
        }
      >
        <header>
          <div>
            <p className="ht-kicker">MONITOR COVERAGE</p>
            <h2>Availability over 24h</h2>
            <p>Measured against each monitor's configured reliability target.</p>
          </div>
          <Radar aria-hidden="true" />
        </header>
        {coverage.length && hasCoverage ? (
          <div className="ht-home-bar-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverage} margin={{ top: 12, right: 8, left: -20, bottom: 6 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--ht-faint)', fontSize: 9 }}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={42}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--ht-faint)', fontSize: 9 }}
                  tickFormatter={(value: number) => `${value}%`}
                />
                <Tooltip
                  cursor={{ fill: 'var(--ht-surface-hover)' }}
                  contentStyle={{
                    border: '1px solid var(--ht-hairline-bright)',
                    borderRadius: '8px',
                    background: 'var(--ht-surface-2)',
                    color: 'var(--ht-ink)',
                    fontSize: '11px',
                  }}
                  formatter={(value: unknown) => [
                    `${typeof value === 'number' || typeof value === 'string' ? value : '—'}%`,
                    'Availability',
                  ]}
                />
                <Bar
                  dataKey="availability"
                  fill="var(--ht-green)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={34}
                  isAnimationActive={!reducedMotion}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="ht-home-chart-empty">
            <Gauge aria-hidden="true" />
            <p>
              {checks > 0
                ? 'Availability will appear when a monitor has a complete check window.'
                : 'Run a monitor to start collecting availability and latency evidence.'}
            </p>
          </div>
        )}
        <footer className="ht-home-chart-footnote">
          <span>
            <CircleAlert aria-hidden="true" /> {checks} checks in the current window
          </span>
          <span>
            <ShieldCheck aria-hidden="true" /> {recovered} recoveries in 24h
          </span>
        </footer>
      </motion.article>
    </section>
  );
}
