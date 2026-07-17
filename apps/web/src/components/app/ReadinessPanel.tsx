import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../lib/api';
import { useI18n } from '../../i18n/I18nContext';
import type { IntegrationSummary } from '../../lib/types';

export function ReadinessPanel({ endpointId }: { endpointId: string }) {
  const { t } = useI18n();
  const [integration, setIntegration] = useState<IntegrationSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ integrations: IntegrationSummary[] }>('/v1/integrations')
      .then((response) => {
        if (!cancelled) {
          setIntegration(
            response.integrations.find((item) => item.endpointId === endpointId) ?? null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setIntegration(null);
      });
    return () => {
      cancelled = true;
    };
  }, [endpointId]);

  if (!integration) return null;
  const failed = integration.readiness.checks
    .filter((check) => !check.passed)
    .sort((left, right) => right.points - left.points);
  const passed = integration.readiness.checks.length - failed.length;
  const level = integration.readiness.level.replace('_', ' ');

  return (
    <section className="ht-readiness" aria-label="Integration readiness">
      <div className="ht-readiness-score">
        <p className="ht-kicker">Production readiness</p>
        <strong>
          {integration.readiness.score}
          <small>/100</small>
        </strong>
        <span className={`ht-readiness-level ${integration.readiness.level}`}>{t(level)}</span>
        <p>
          {passed} {t('of')} {integration.readiness.checks.length}{' '}
          {t('reliability controls proven.')}
        </p>
      </div>
      <div className="ht-readiness-checks">
        <header>
          <div>
            <h2>What is proven — and what is missing</h2>
            <p>Every point comes from configuration or recorded evidence, never a hidden grade.</p>
          </div>
          <Link to="/app/demo">Run full proof</Link>
        </header>
        <div className="ht-readiness-grid">
          {integration.readiness.checks.map((check) => (
            <article key={check.code} className={check.passed ? 'passed' : 'missing'}>
              <span>{check.passed ? '✓' : `−${check.points}`}</span>
              <div>
                <b>{t(check.label)}</b>
                <small>
                  {check.passed ? `${check.points} ${t('points proven')}` : t(check.action)}
                </small>
              </div>
            </article>
          ))}
        </div>
        {failed[0] ? (
          <footer>
            <b>Highest-impact next step</b>
            <span>{t(failed[0].action)}</span>
          </footer>
        ) : (
          <footer className="complete">
            <b>Production baseline proven</b>
            <span>Repeat the recovery trial after meaningful integration changes.</span>
          </footer>
        )}
      </div>
    </section>
  );
}
