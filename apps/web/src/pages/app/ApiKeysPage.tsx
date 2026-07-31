import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { CopyButton } from '../../components/ui/CopyButton';
import { useI18n } from '../../i18n/I18nContext';
import { apiRequest, readableError } from '../../lib/api';
import type { ApiKey } from '../../lib/types';

export function ApiKeysPage() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [read, setRead] = useState(true);
  const [write, setWrite] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const response = await apiRequest<{ apiKeys: ApiKey[] }>('/v1/api-keys');
      setKeys(response.apiKeys);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createKey(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const scopes = [read ? 'read' : null, write ? 'write' : null].filter(
        (scope): scope is 'read' | 'write' => scope !== null,
      );
      const response = await apiRequest<{ apiKey: ApiKey; secret: string }>('/v1/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, scopes }),
      });
      setKeys((items) => [response.apiKey, ...items]);
      setSecret(response.secret);
      setName('');
      setNotice(t('The secret is shown once. Copy it before leaving this page.'));
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(key: ApiKey) {
    if (!window.confirm(`${t('Revoke')} “${key.name}”?`)) return;
    try {
      await apiRequest(`/v1/api-keys/${key.id}`, { method: 'DELETE' });
      setKeys((items) =>
        items.map((item) =>
          item.id === key.id ? { ...item, revokedAt: new Date().toISOString() } : item,
        ),
      );
      if (secret) setSecret(null);
    } catch (cause) {
      setError(readableError(cause));
    }
  }

  return (
    <section className="ht-page ht-api-keys" data-product-area="resources">
      <header className="ht-page-head ht-shared-page-head">
        <div>
          <p className="ht-kicker">{t('AUTOMATION')}</p>
          <h1>{t('API keys')}</h1>
          <p className="ht-muted-line">
            {t(
              'Run safe synthetic checks and export redacted evidence from CI without a browser session.',
            )}
          </p>
        </div>
        <KeyRound aria-hidden="true" />
      </header>

      <div className="ht-api-key-layout">
        <form className="ht-api-key-create" onSubmit={(event) => void createKey(event)}>
          <div>
            <p className="ht-kicker">{t('NEW CREDENTIAL')}</p>
            <h2>{t('Create an API key')}</h2>
          </div>
          <label className="ht-field">
            {t('Name')}
            <input
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ci-production"
            />
          </label>
          <fieldset className="ht-api-key-scopes">
            <legend>{t('Scopes')}</legend>
            <label>
              <input
                type="checkbox"
                checked={read}
                onChange={(event) => setRead(event.target.checked)}
              />
              <span>
                <strong>read</strong>
                <small>{t('Export redacted evidence')}</small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={write}
                onChange={(event) => setWrite(event.target.checked)}
              />
              <span>
                <strong>write</strong>
                <small>{t('Run a synthetic endpoint check')}</small>
              </span>
            </label>
          </fieldset>
          <button className="button primary" type="submit" disabled={saving || (!read && !write)}>
            <KeyRound aria-hidden="true" />
            {saving ? t('Creating…') : t('Create key')}
          </button>
          {notice ? (
            <p className="ht-form-success" role="status">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="ht-form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <aside className="ht-api-key-guide">
          <ShieldCheck aria-hidden="true" />
          <h2>{t('Designed for automation')}</h2>
          <p>{t('Keys are shown once, stored as hashes and can be revoked independently.')}</p>
          <p>{t('Keep them in your CI secret store. Never commit a key or paste it into logs.')}</p>
        </aside>
      </div>

      {secret ? (
        <section className="ht-api-key-secret" role="alert">
          <div>
            <p className="ht-kicker">{t('COPY NOW')}</p>
            <h2>{t('Your new secret')}</h2>
            <p>{t('This value will not be shown again.')}</p>
          </div>
          <code>{secret}</code>
          <CopyButton value={secret} label={t('Copy secret')} copiedLabel={t('Copied')} />
        </section>
      ) : null}

      <section className="ht-api-key-list" aria-labelledby="api-key-list-title">
        <header>
          <div>
            <p className="ht-kicker">{t('CREDENTIALS')}</p>
            <h2 id="api-key-list-title">{t('Active and revoked keys')}</h2>
          </div>
          <span>{loading ? '…' : keys.length}</span>
        </header>
        {!loading && keys.length === 0 ? (
          <p className="ht-form-note">
            {t('No API keys yet. Create one for your first CI workflow.')}
          </p>
        ) : (
          <div className="ht-api-key-rows">
            {keys.map((key) => (
              <article key={key.id} className={key.revokedAt ? 'revoked' : ''}>
                <div>
                  <strong>{key.name}</strong>
                  <code>{key.keyPrefix}…</code>
                </div>
                <small>
                  {key.scopes.join(' · ')} · {key.revokedAt ? t('revoked') : t('never revoked')}
                </small>
                {!key.revokedAt ? (
                  <button
                    className="button danger compact"
                    type="button"
                    onClick={() => void revokeKey(key)}
                  >
                    <Trash2 aria-hidden="true" /> {t('Revoke')}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
