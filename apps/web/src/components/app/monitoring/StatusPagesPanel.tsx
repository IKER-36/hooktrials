import { useState, type CSSProperties, type FormEvent } from 'react';
import { CopyButton } from '../../ui/CopyButton';
import { useI18n } from '../../../i18n/I18nContext';
import { apiRequest, readableError } from '../../../lib/api';
import { STATE_LABEL } from './shared';
import type { MonitorSummary, StatusPageConfig } from '../../../lib/types';

export function StatusPagesPanel({
  monitors,
  pages,
  onChanged,
}: {
  monitors: MonitorSummary[];
  pages: StatusPageConfig[];
  onChanged(): Promise<void>;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<StatusPageConfig | 'new' | null>(null);
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState(() => t('All systems operational'));
  const [description, setDescription] = useState(() =>
    t('Live availability and incident history.'),
  );
  const [accentColor, setAccentColor] = useState('#36e37e');
  const [monitorIds, setMonitorIds] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  function openEditor(page?: StatusPageConfig) {
    setEditing(page ?? 'new');
    setName(page?.name ?? t('Service status'));
    setHeadline(page?.headline ?? t('All systems operational'));
    setDescription(page?.description ?? t('Live availability and incident history.'));
    setAccentColor(page?.accentColor ?? '#36e37e');
    setMonitorIds(page?.monitorIds ?? monitors.slice(0, 1).map((monitor) => monitor.id));
    setEnabled(page?.enabled ?? true);
    setMessage('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (monitorIds.length === 0) {
      setMessage('Choose at least one monitor.');
      return;
    }
    setBusy('save');
    setMessage('');
    try {
      const current = editing === 'new' ? null : editing;
      await apiRequest(current ? `/v1/status-pages/${current.id}` : '/v1/status-pages', {
        method: current ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          headline,
          description: description || null,
          accentColor,
          monitorIds,
          enabled,
        }),
      });
      setEditing(null);
      await onChanged();
    } catch (requestError) {
      setMessage(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  async function remove(page: StatusPageConfig) {
    if (!window.confirm(`Delete status page “${page.name}”?`)) return;
    setBusy(page.id);
    try {
      await apiRequest(`/v1/status-pages/${page.id}`, { method: 'DELETE' });
      await onChanged();
    } catch (requestError) {
      setMessage(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  async function rotate(page: StatusPageConfig) {
    if (!window.confirm('Rotate this public link? The previous URL will stop working.')) return;
    setBusy(page.id);
    try {
      await apiRequest(`/v1/status-pages/${page.id}/rotate`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      await onChanged();
    } catch (requestError) {
      setMessage(readableError(requestError));
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="ht-status-pages">
      <header>
        <div>
          <h2>Status pages</h2>
          <p>Publish a branded, read-only view containing only the monitors you choose.</p>
        </div>
        <button
          type="button"
          className="button"
          disabled={monitors.length === 0}
          onClick={() => openEditor()}
        >
          New status page
        </button>
      </header>
      {pages.length === 0 ? (
        <p className="ht-status-pages-empty">
          {monitors.length === 0
            ? 'Create a monitor before publishing a status page.'
            : 'No custom status page yet. Create one to share selected service health.'}
        </p>
      ) : (
        <div className="ht-status-page-list">
          {pages.map((page) => (
            <article key={page.id} style={{ '--status-accent': page.accentColor } as CSSProperties}>
              <i />
              <div>
                <strong>{page.name}</strong>
                <span>{page.headline}</span>
                <small>
                  {page.monitorIds.length}{' '}
                  {t(page.monitorIds.length === 1 ? 'monitor' : 'monitors')} ·{' '}
                  {t(page.enabled ? 'public' : 'disabled')}
                </small>
              </div>
              <div className="ht-status-page-actions">
                {page.shareUrl ? (
                  <>
                    <a href={page.shareUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                    <CopyButton value={page.shareUrl} label="Copy link" />
                  </>
                ) : null}
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => openEditor(page)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => void rotate(page)}
                  disabled={busy === page.id}
                  aria-busy={busy === page.id}
                >
                  Rotate
                </button>
                <button
                  type="button"
                  className="button danger compact"
                  onClick={() => void remove(page)}
                  disabled={busy === page.id}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {message && !editing ? <p className="ht-form-error">{message}</p> : null}
      {editing ? (
        <form className="ht-status-page-form" onSubmit={(event) => void save(event)}>
          <div className="ht-monitor-form-grid">
            <label className="ht-field">
              Internal name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                minLength={2}
                maxLength={80}
              />
            </label>
            <label className="ht-field">
              Public headline
              <input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label className="ht-field ht-field-wide">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
              />
            </label>
            <label className="ht-field">
              Accent color
              <input
                type="color"
                value={accentColor}
                onChange={(event) => setAccentColor(event.target.value)}
              />
            </label>
            <label className="ht-inline-check">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
              />{' '}
              Public page enabled
            </label>
          </div>
          <fieldset className="ht-status-monitor-picker">
            <legend>Monitors shown publicly</legend>
            {monitors.map((monitor) => (
              <label key={monitor.id}>
                <input
                  type="checkbox"
                  checked={monitorIds.includes(monitor.id)}
                  onChange={(event) =>
                    setMonitorIds((current) =>
                      event.target.checked
                        ? [...current, monitor.id]
                        : current.filter((id) => id !== monitor.id),
                    )
                  }
                />
                <span className={`ht-monitor-state ${monitor.state}`}>
                  {STATE_LABEL[monitor.state]}
                </span>
                <strong>{monitor.name}</strong>
                <small>
                  {monitor.protocol.toUpperCase()} · {monitor.displayHost}
                </small>
              </label>
            ))}
          </fieldset>
          {message ? <p className="ht-form-error">{message}</p> : null}
          <div className="ht-form-actions">
            <button type="button" className="button secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={busy === 'save'}
              aria-busy={busy === 'save'}
            >
              {busy === 'save' ? 'Saving…' : 'Save status page'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
