import type { Incident, MonitorCheck, MonitorState, MonitorSummary } from '../../../lib/types';

export const STATE_LABEL: Record<MonitorState, string> = {
  new: 'NEW',
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  down: 'DOWN',
  paused: 'PAUSED',
};

/* Checks accumulate every 10s, so the retained history grows without bound.
   Show the newest window and say how much is being held back. */
export const RECENT_CHECK_LIMIT = 10;

export interface MonitorDetailResponse {
  monitor: MonitorSummary;
  checks: MonitorCheck[];
  incidents: Incident[];
}

export function metric(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value}${suffix}`;
}
