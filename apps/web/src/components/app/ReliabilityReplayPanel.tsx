import type { ReliabilityReplay } from '../../lib/types';

function duration(value: number): string {
  if (value < 1_000) return `${value} ms`;
  if (value < 60_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} s`;
  return `${Math.floor(value / 60_000)}m ${Math.round((value % 60_000) / 1_000)}s`;
}

export function ReliabilityReplayPanel({ replay }: { replay: ReliabilityReplay }) {
  return (
    <section className={`ht-replay ${replay.outcome}`} aria-label="Reliability Replay">
      <header>
        <div>
          <p className="ht-kicker">Reliability Replay</p>
          <h3>{replay.headline}</h3>
        </div>
        <span>{replay.outcome}</span>
      </header>
      <p className="ht-replay-diagnosis">{replay.diagnosis}</p>
      <div className="ht-replay-impact">
        <span>
          <b>Impact</b>
          {replay.impact}
        </span>
        <span>
          <b>Recorded window</b>
          {duration(replay.durationMs)}
        </span>
      </div>
      <ol className="ht-replay-steps">
        {replay.steps.map((step, index) => (
          <li key={step.code} className={step.state}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div>
              <b>{step.label}</b>
              <small>{step.detail}</small>
            </div>
          </li>
        ))}
      </ol>
      <div className="ht-replay-runbook">
        <b>Evidence-based runbook</b>
        <ol>
          {replay.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
