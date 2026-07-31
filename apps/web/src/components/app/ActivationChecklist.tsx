import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nContext';
import { apiRequest } from '../../lib/api';
import type { Endpoint, OperationsResponse } from '../../lib/types';

interface ActivationChecklistProps {
  endpoints: Endpoint[];
}

interface ActivationData {
  eventObserved: boolean;
  monitorConfigured: boolean;
  operationsEvidence: boolean;
}

const INITIAL_DATA: ActivationData = {
  eventObserved: false,
  monitorConfigured: false,
  operationsEvidence: false,
};

/**
 * A short, evidence-led activation path for new accounts. It deliberately
 * uses existing read APIs so it never creates resources or changes a user's
 * workspace by itself.
 */
export function ActivationChecklist({ endpoints }: ActivationChecklistProps) {
  const { t } = useI18n();
  const [data, setData] = useState<ActivationData>(INITIAL_DATA);

  const trialEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.mode === 'trial'),
    [endpoints],
  );
  const liveRoute = useMemo(
    () => endpoints.find((endpoint) => endpoint.mode !== 'trial' && !endpoint.demoOwned),
    [endpoints],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const eventRequest = trialEndpoint
        ? apiRequest<{ events: Array<{ id: string }> }>(`/v1/endpoints/${trialEndpoint.id}/events`)
        : Promise.resolve({ events: [] });

      try {
        const [events, monitors, operations] = await Promise.all([
          eventRequest,
          apiRequest<{ monitors: Array<{ id: string }> }>('/v1/monitors'),
          apiRequest<OperationsResponse>('/v1/operations'),
        ]);
        if (cancelled) return;
        setData({
          eventObserved: events.events.length > 0,
          monitorConfigured: monitors.monitors.length > 0,
          operationsEvidence:
            operations.summary.recovered24h > 0 ||
            operations.summary.openIncidents > 0 ||
            operations.summary.unresolvedDeadLetters > 0,
        });
      } catch {
        // The checklist is guidance, not a gate. Existing page content remains
        // usable when one of the supporting read APIs is temporarily offline.
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [trialEndpoint]);

  const steps = [
    {
      key: 'trial',
      complete: Boolean(trialEndpoint),
      label: t('Create a safe Trial endpoint'),
      detail: t('Start with synthetic traffic and controlled failures.'),
      to: '/app/endpoints',
      action: t('Create endpoint'),
    },
    {
      key: 'event',
      complete: data.eventObserved,
      label: t('Observe your first delivery'),
      detail: t('Run the guided demo or send the generated curl request.'),
      to: trialEndpoint ? `/app/control-center/${trialEndpoint.id}` : '/app/demo',
      action: t('Open Control Center'),
    },
    {
      key: 'route',
      complete: Boolean(liveRoute),
      label: t('Connect a real webhook route'),
      detail: t('Use Webhook Hub when a provider should reach your backend.'),
      to: '/app/live-webhooks',
      action: t('Open Webhook Hub'),
    },
    {
      key: 'monitor',
      complete: data.monitorConfigured,
      label: t('Monitor one dependency'),
      detail: t('Check availability, latency and response expectations.'),
      to: '/app/monitor',
      action: t('Add a monitor'),
    },
    {
      key: 'evidence',
      complete: data.operationsEvidence,
      label: t('Review operational evidence'),
      detail: t('Use Operations to inspect incidents, recovery and delivery state.'),
      to: '/app/operations',
      action: t('Open Operations'),
    },
  ];
  const completed = steps.filter((step) => step.complete).length;
  const next = steps.find((step) => !step.complete);

  return (
    <section className="ht-activation" aria-labelledby="activation-title">
      <header className="ht-activation-head">
        <div>
          <p className="ht-kicker">{t('START HERE')}</p>
          <h2 id="activation-title">{t('Turn a new account into useful evidence')}</h2>
          <p className="ht-muted-line">
            {t(
              'Complete the path in any order. HookTrials only marks a step when the workspace has evidence for it.',
            )}
          </p>
        </div>
        <strong className="ht-activation-progress">
          {completed}/{steps.length}
        </strong>
      </header>
      <ol className="ht-activation-list">
        {steps.map((step, index) => (
          <li key={step.key} className={step.complete ? 'complete' : ''}>
            <span className="ht-activation-index" aria-hidden="true">
              {step.complete ? <Check /> : index + 1}
            </span>
            <div>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </div>
            {!step.complete ? (
              <Link className="button secondary compact" to={step.to}>
                {step.action} <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <span className="ht-activation-done">{t('Proven')}</span>
            )}
          </li>
        ))}
      </ol>
      {next ? (
        <footer>
          <span>{t('Recommended next step')}</span>
          <Link to={next.to}>
            {next.action} <ArrowRight aria-hidden="true" />
          </Link>
        </footer>
      ) : (
        <footer className="complete">
          <span>{t('Activation path complete')}</span>
          <span>{t('Keep the baseline and repeat it after meaningful integration changes.')}</span>
        </footer>
      )}
    </section>
  );
}
