import { StatusChip } from '../ui/StatusChip';
import type { AttemptSummary, DestinationDelivery } from '../../lib/types';

export type EventOutcome = 'recovered' | 'delivered' | 'protected' | 'failing';

export function eventOutcome(
  attempts: AttemptSummary[],
  deliveries: DestinationDelivery[] = [],
): EventOutcome {
  if (deliveries.length > 0) {
    const lastDelivery = deliveries[deliveries.length - 1]!;
    if (lastDelivery.state === 'succeeded') {
      return deliveries.length > 1 ? 'recovered' : 'delivered';
    }
    if (['queued', 'delivering', 'retrying'].includes(lastDelivery.state)) return 'protected';
    return 'failing';
  }
  const last = attempts[attempts.length - 1];
  if (!last) return 'failing';
  const ok = last.statusCode >= 200 && last.statusCode < 300;
  if (!ok) return 'failing';
  return attempts.length > 1 ? 'recovered' : 'delivered';
}

export function OutcomeBadge({
  attempts,
  deliveries = [],
}: {
  attempts: AttemptSummary[];
  deliveries?: DestinationDelivery[];
}) {
  const outcome = eventOutcome(attempts, deliveries);
  const tone = outcome === 'failing' ? 'danger' : outcome === 'protected' ? 'warning' : 'success';
  return <span className={`ht-outcome ${tone}`}>{outcome.toUpperCase()}</span>;
}

export function AttemptSequence({
  attempts,
  deliveries = [],
}: {
  attempts: AttemptSummary[];
  deliveries?: DestinationDelivery[];
}) {
  if (deliveries.length > 0) {
    return (
      <ol className="ht-sequence" aria-label={`${deliveries.length} destination delivery attempts`}>
        {deliveries.map((delivery, index) => (
          <li key={delivery.id}>
            {index > 0 ? (
              <span className="ht-sequence-link" aria-hidden="true">
                ──
              </span>
            ) : null}
            {delivery.statusCode ? (
              <StatusChip code={delivery.statusCode} />
            ) : (
              <code>{delivery.state}</code>
            )}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="ht-sequence" aria-label={`${attempts.length} delivery attempts`}>
      {attempts.map((attempt, index) => (
        <li key={attempt.sequence}>
          {index > 0 ? (
            <span className="ht-sequence-link" aria-hidden="true">
              ──
            </span>
          ) : null}
          <StatusChip code={attempt.statusCode} />
        </li>
      ))}
    </ol>
  );
}
