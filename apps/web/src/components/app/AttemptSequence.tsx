import { StatusChip } from '../ui/StatusChip';
import type { AttemptSummary } from '../../lib/types';

export type EventOutcome = 'recovered' | 'delivered' | 'failing';

export function eventOutcome(attempts: AttemptSummary[]): EventOutcome {
  const last = attempts[attempts.length - 1];
  if (!last) return 'failing';
  const ok = last.statusCode >= 200 && last.statusCode < 300;
  if (!ok) return 'failing';
  return attempts.length > 1 ? 'recovered' : 'delivered';
}

export function OutcomeBadge({ attempts }: { attempts: AttemptSummary[] }) {
  const outcome = eventOutcome(attempts);
  const tone = outcome === 'failing' ? 'danger' : 'success';
  return <span className={`ht-outcome ${tone}`}>{outcome.toUpperCase()}</span>;
}

export function AttemptSequence({ attempts }: { attempts: AttemptSummary[] }) {
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
