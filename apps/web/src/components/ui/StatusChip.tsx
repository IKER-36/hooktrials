export type StatusTone = 'success' | 'warning' | 'danger';

export function statusTone(status: number): StatusTone {
  if (status >= 200 && status < 300) return 'success';
  if (status === 429 || (status >= 300 && status < 500)) return 'warning';
  return 'danger';
}

export function StatusChip({ code, note }: { code: number; note?: string }) {
  return (
    <span className={`ht-status ${statusTone(code)}`}>
      <code>{code}</code>
      {note ? <small>{note}</small> : null}
    </span>
  );
}
