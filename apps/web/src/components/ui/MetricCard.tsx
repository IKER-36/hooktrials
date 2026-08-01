import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'healthy' | 'warning' | 'danger';
}

/** A compact metric contract shared by Home and operational summaries. */
export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
}: MetricCardProps) {
  return (
    <article className={`ht-metric-card ${tone}`}>
      <div className="ht-metric-card-topline">
        <span>{label}</span>
        <Icon aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
