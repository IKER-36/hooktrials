import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared page heading contract for the workspace.
 *
 * Keeping the heading, supporting copy and actions in one primitive prevents
 * each module from inventing a slightly different top-of-page layout. The
 * surrounding page still owns its data and actions; this component only owns
 * hierarchy and responsive disposition.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`ht-page-head ht-shared-page-head ${className}`.trim()}>
      <div>
        {eyebrow ? <p className="ht-kicker">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="ht-muted-line">{description}</p> : null}
      </div>
      {actions ? <div className="ht-page-head-actions">{actions}</div> : null}
    </header>
  );
}
