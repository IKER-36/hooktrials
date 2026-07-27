import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, readableError } from '../../lib/api';

interface Channel {
  id: string;
  displayHost: string;
  provider: 'generic' | 'discord';
  scopes: Array<'monitor' | 'webhook'>;
  events: Array<'opened' | 'recovered'>;
  active: boolean;
  allowPrivateNetworks: boolean;
  allowedPrivateCidrs: string[];
  hasHeaders: boolean;
  recent: Array<{
    id: string;
    event: string;
    state: string;
    statusCode: number | null;
    attemptedAt: string | null;
  }>;
}

export function AlertChannelPanel() {
  const { setup } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [provider, setProvider] = useState<'generic' | 'discord'>('generic');
  const [scopes, setScopes] = useState<Array<'monitor' | 'webhook'>>(['monitor', 'webhook']);
  const [events, setEvents] = useState<Array<'opened' | 'recovered'>>(['opened', 'recovered']);
  const [active, setActive] = useState(true);
  const [allowPrivate, setAllowPrivate] = useState(false);
  const [cidrs, setCidrs] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  // `message` alone doesn't say whether the last outcome was good or bad, so a
  // save failure or a failed test delivery rendered with the same success
  // styling and a polite (not alert) live-region role as an actual success.
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');

  function report(text: string, tone: 'success' | 'error') {
    setMessage(text);
    setMessageTone(tone);
  }

  async function load() {
    const response = await apiRequest<{ channel: Channel | null }>('/v1/alert-channel');
    setChannel(response.channel);
    if (response.channel) {
      setProvider(response.channel.provider);
      setScopes(response.channel.scopes);
      setEvents(response.channel.events);
      setActive(response.channel.active);
      setAllowPrivate(response.channel.allowPrivateNetworks);
      setCidrs(response.channel.allowedPrivateCidrs.join(', '));
    }
  }
  useEffect(() => {
    void load().catch((error) => report(readableError(error), 'error'));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy('save');
    setMessage('');
    try {
      let parsedHeaders: Record<string, string> = {};
      if (headers.trim()) parsedHeaders = JSON.parse(headers) as Record<string, string>;
      await apiRequest('/v1/alert-channel', {
        method: 'PUT',
        body: JSON.stringify({
          ...(url.trim() ? { url: url.trim() } : {}),
          ...(headers.trim() ? { headers: parsedHeaders } : {}),
          provider,
          scopes,
          events,
          active,
          allowPrivateNetworks: setup?.deploymentMode === 'selfhost' ? allowPrivate : false,
          allowedPrivateCidrs:
            setup?.deploymentMode === 'selfhost' && allowPrivate
              ? cidrs
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean)
              : [],
        }),
      });
      setUrl('');
      setHeaders('');
      report('Alert channel saved. Send a test before relying on it.', 'success');
      await load();
    } catch (error) {
      report(
        error instanceof SyntaxError || (error instanceof Error && !('status' in error))
          ? error.message
          : readableError(error),
        'error',
      );
    } finally {
      setBusy('');
    }
  }

  async function test() {
    setBusy('test');
    setMessage('');
    try {
      const result = await apiRequest<{
        provider: 'generic' | 'discord';
        delivered: boolean;
        statusCode: number;
        latencyMs: number;
      }>('/v1/alert-channel/test', { method: 'POST' });
      report(
        result.delivered
          ? `Test delivered · HTTP ${result.statusCode} · ${result.latencyMs} ms`
          : `Test failed · HTTP ${result.statusCode}`,
        result.delivered ? 'success' : 'error',
      );
    } catch (error) {
      report(readableError(error), 'error');
    } finally {
      setBusy('');
    }
  }

  function toggleScope(scope: 'monitor' | 'webhook') {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
  }

  function toggleEvent(event: 'opened' | 'recovered') {
    setEvents((current) =>
      current.includes(event) ? current.filter((item) => item !== event) : [...current, event],
    );
  }

  return (
    <details id="alert-channel" className="ht-alert-panel" open={!channel}>
      <summary>
        <span>
          <b>Outgoing incident alerts</b>
          <small>
            {channel
              ? `${channel.provider === 'discord' ? 'Discord' : 'Webhook'} · ${channel.displayHost} · ${channel.active ? 'active' : 'paused'}`
              : 'Not configured'}
          </small>
        </span>
        <span>MONITORS + WEBHOOKS</span>
      </summary>
      <form onSubmit={(event) => void save(event)}>
        <p>
          Send redacted incident notifications to Discord or your own webhook. Choose which product
          areas and lifecycle events may notify this channel.
        </p>
        <div className="ht-monitor-form-grid">
          <label className="ht-field">
            Destination type
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as 'generic' | 'discord')}
            >
              <option value="discord">Discord</option>
              <option value="generic">Generic webhook</option>
            </select>
          </label>
          <label className="ht-field ht-field-wide">
            {provider === 'discord' ? 'Discord webhook URL' : 'Alert webhook URL'}
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required={!channel}
              placeholder={
                channel
                  ? `Encrypted · ${channel.displayHost}`
                  : provider === 'discord'
                    ? 'https://discord.com/api/webhooks/…'
                    : 'https://alerts.example.com/hooktrials'
              }
            />
            <small>
              {channel
                ? 'Leave empty to keep the encrypted URL already saved.'
                : provider === 'discord'
                  ? 'Discord → Server settings → Integrations → Webhooks → Copy webhook URL.'
                  : 'HookTrials posts a stable, redacted JSON incident contract.'}
            </small>
          </label>
          {provider === 'generic' ? (
            <label className="ht-field ht-field-wide">
              Headers (optional, write-only JSON)
              <textarea
                value={headers}
                onChange={(event) => setHeaders(event.target.value)}
                placeholder='{"authorization":"Bearer …"}'
              />
              <small>Leave empty to keep existing encrypted headers.</small>
            </label>
          ) : null}
        </div>
        <div className="ht-alert-preferences">
          <fieldset>
            <legend>Notify for</legend>
            <label>
              <input
                type="checkbox"
                checked={scopes.includes('monitor')}
                disabled={scopes.length === 1 && scopes.includes('monitor')}
                onChange={() => toggleScope('monitor')}
              />
              Monitoring incidents
            </label>
            <label>
              <input
                type="checkbox"
                checked={scopes.includes('webhook')}
                disabled={scopes.length === 1 && scopes.includes('webhook')}
                onChange={() => toggleScope('webhook')}
              />
              Webhook delivery incidents
            </label>
          </fieldset>
          <fieldset>
            <legend>Lifecycle events</legend>
            <label>
              <input
                type="checkbox"
                checked={events.includes('opened')}
                disabled={events.length === 1 && events.includes('opened')}
                onChange={() => toggleEvent('opened')}
              />
              Incident opened
            </label>
            <label>
              <input
                type="checkbox"
                checked={events.includes('recovered')}
                disabled={events.length === 1 && events.includes('recovered')}
                onChange={() => toggleEvent('recovered')}
              />
              Incident recovered
            </label>
          </fieldset>
          <label className="ht-alert-active">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Channel active
          </label>
        </div>
        {setup?.deploymentMode === 'selfhost' ? (
          <div className="ht-private-monitor">
            <label>
              <input
                type="checkbox"
                checked={allowPrivate}
                onChange={(event) => setAllowPrivate(event.target.checked)}
              />{' '}
              Allow explicit private CIDRs
            </label>
            {allowPrivate ? (
              <input
                aria-label="Allowed private CIDRs for this alert channel"
                value={cidrs}
                onChange={(event) => setCidrs(event.target.value)}
                required
                placeholder="10.0.0.0/24"
              />
            ) : null}
          </div>
        ) : null}
        {message ? (
          <p
            className={messageTone === 'error' ? 'ht-form-error' : 'ht-form-success'}
            role={messageTone === 'error' ? 'alert' : 'status'}
          >
            {message}
          </p>
        ) : null}
        <div className="ht-monitor-actions">
          <button className="button primary" type="submit" disabled={Boolean(busy)}>
            {busy === 'save' ? 'Saving…' : channel ? 'Update channel' : 'Save channel'}
          </button>
          {channel ? (
            <button
              className="button secondary"
              type="button"
              onClick={() => void test()}
              disabled={Boolean(busy)}
            >
              {busy === 'test' ? 'Sending…' : 'Send test alert'}
            </button>
          ) : null}
        </div>
        {channel?.recent.length ? (
          <ul className="ht-alert-history">
            {channel.recent.slice(0, 5).map((item) => (
              <li key={item.id}>
                <b>{item.event.toUpperCase()}</b>
                <span>
                  {item.state} · HTTP {item.statusCode ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
    </details>
  );
}
