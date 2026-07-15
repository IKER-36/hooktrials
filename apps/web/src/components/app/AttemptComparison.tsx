import { useMemo } from 'react';
import type { AttemptDetail } from '../../lib/types';

function contractState(attempt: AttemptDetail): string {
  if (!attempt.contractResult.configured) return 'not configured';
  return attempt.contractResult.passed ? 'passed' : 'failed';
}

export function AttemptComparison({
  baseline,
  current,
}: {
  baseline: AttemptDetail;
  current: AttemptDetail;
}) {
  const headers = useMemo(() => {
    const keys = new Set([...Object.keys(baseline.headers), ...Object.keys(current.headers)]);
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const key of keys) {
      if (!(key in baseline.headers)) added += 1;
      else if (!(key in current.headers)) removed += 1;
      else if (JSON.stringify(baseline.headers[key]) !== JSON.stringify(current.headers[key]))
        changed += 1;
    }
    return { added, removed, changed };
  }, [baseline, current]);
  const rows = [
    {
      label: 'Response',
      before: `HTTP ${baseline.responseStatus}`,
      after: `HTTP ${current.responseStatus}`,
    },
    {
      label: 'Delay',
      before: `${baseline.responseDelayMs} ms`,
      after: `${current.responseDelayMs} ms`,
    },
    {
      label: 'Signature',
      before: baseline.signatureStatus.replace('_', ' '),
      after: current.signatureStatus.replace('_', ' '),
    },
    { label: 'Contract', before: contractState(baseline), after: contractState(current) },
    {
      label: 'Payload',
      before: `${baseline.body.length} chars`,
      after:
        baseline.body === current.body ? 'unchanged' : `${current.body.length} chars · changed`,
    },
    {
      label: 'Headers',
      before: `${Object.keys(baseline.headers).length} captured`,
      after: `+${headers.added} / −${headers.removed} / ${headers.changed} changed`,
    },
  ];

  return (
    <details className="ht-attempt-compare">
      <summary>Compare attempt 01 → {String(current.sequence).padStart(2, '0')}</summary>
      <div className="ht-compare-grid" role="table" aria-label="Attempt comparison">
        <div className="head" role="row">
          <b>Signal</b>
          <b>First attempt</b>
          <b>Selected attempt</b>
        </div>
        {rows.map((row) => (
          <div key={row.label} role="row">
            <span>{row.label}</span>
            <code>{row.before}</code>
            <code>{row.after}</code>
          </div>
        ))}
      </div>
      <p>Payload values and secret headers stay inside the authenticated inspector.</p>
    </details>
  );
}
