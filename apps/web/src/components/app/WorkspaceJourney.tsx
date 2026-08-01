import { Activity, FileText, Gauge, Home, RadioTower, Radar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const steps: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/live-webhooks', label: 'Connect', icon: RadioTower },
  { to: '/app/control-center', label: 'Inspect', icon: Gauge },
  { to: '/app/monitor', label: 'Measure', icon: Radar },
  { to: '/app/operations', label: 'Recover', icon: Activity },
  { to: '/app/evidence', label: 'Prove', icon: FileText },
];

/**
 * A compact, contextual path through the product. The sidebar remains the
 * global navigation; this strip explains the operational order without
 * hiding secondary modules or creating another destination.
 */
export function WorkspaceJourney() {
  return (
    <nav className="ht-workspace-journey" aria-label="Reliability workflow">
      <span className="ht-workspace-journey-label">WORKFLOW</span>
      <ol>
        {steps.map(({ to, label, icon: Icon, end }, index) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              aria-label={`${index + 1}. ${label}`}
            >
              <span className="ht-workspace-journey-index">0{index + 1}</span>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
            {index < steps.length - 1 ? (
              <span className="ht-workspace-journey-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}
