import { ArrowRight, BellRing, RadioTower, Radar, Route, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Endpoint } from '../../lib/types';

interface RouteJourneyProps {
  endpoint: Endpoint;
}

const steps = [
  { id: 'setup', label: 'Setup', icon: Route },
  { id: 'traffic', label: 'Traffic', icon: RadioTower },
  { id: 'monitor', label: 'Monitor', icon: Radar },
  { id: 'recover', label: 'Recover', icon: BellRing },
] as const;

export function RouteJourney({ endpoint }: RouteJourneyProps) {
  const setupPath = endpoint.mode === 'trial' ? '/app/endpoints' : '/app/live-webhooks';

  return (
    <section className="ht-route-journey" aria-labelledby="route-journey-title">
      <header>
        <div>
          <p className="ht-kicker">ROUTE JOURNEY</p>
          <h2 id="route-journey-title">From setup to recovery</h2>
          <p>
            Keep this route's lifecycle in view. Each step opens the module that owns the next piece
            of evidence.
          </p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </header>
      <ol>
        {steps.map((step, index) => {
          const Icon = step.icon;
          const current = step.id === 'traffic';
          const content = (
            <>
              <span className="ht-route-journey-index">0{index + 1}</span>
              <Icon aria-hidden="true" />
              <span>
                <strong>{step.label}</strong>
                <small>
                  {step.id === 'setup'
                    ? endpoint.mode === 'trial'
                      ? 'Choose a deterministic scenario'
                      : 'Provider, destination and delivery mode'
                    : step.id === 'traffic'
                      ? 'Inspect requests and delivery evidence'
                      : step.id === 'monitor'
                        ? 'Measure the dependency boundary'
                        : 'Triage incidents and recovery'}
                </small>
              </span>
              {index < steps.length - 1 ? <ArrowRight aria-hidden="true" /> : null}
            </>
          );

          return (
            <li key={step.id} className={current ? 'current' : undefined}>
              {current ? (
                <div aria-current="step">{content}</div>
              ) : (
                <Link
                  to={
                    step.id === 'setup'
                      ? setupPath
                      : step.id === 'monitor'
                        ? '/app/monitor#integration-inventory'
                        : '/app/operations#incident-timeline'
                  }
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
