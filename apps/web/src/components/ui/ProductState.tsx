import type { ReactNode } from 'react';

interface ProductStateProps {
  eyebrow?: string;
  title: string;
  description: string;
  tone?: 'neutral' | 'danger' | 'positive';
  action?: ReactNode;
  compact?: boolean;
}

export function ProductState({
  eyebrow = 'Next action',
  title,
  description,
  tone = 'neutral',
  action,
  compact = false,
}: ProductStateProps) {
  return (
    <section
      className={`ht-product-state ${compact ? 'compact' : ''}`}
      data-tone={tone}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div>
        <p className="ht-product-state-kicker">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div className="ht-product-state-action">{action}</div> : null}
    </section>
  );
}
