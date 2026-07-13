import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, readableError } from '../../lib/api';

interface Channel {
  id: string;
  displayHost: string;
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
  const [active, setActive] = useState(true);
  const [allowPrivate, setAllowPrivate] = useState(false);
  const [cidrs, setCidrs] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const response = await apiRequest<{ channel: Channel | null }>('/v1/alert-channel');
    setChannel(response.channel);
    if (response.channel) {
      setActive(response.channel.active);
      setAllowPrivate(response.channel.allowPrivateNetworks);
      setCidrs(response.channel.allowedPrivateCidrs.join(', '));
    }
  }
  useEffect(() => {
    void load().catch((error) => setMessage(readableError(error)));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy('save');
    setMessage('');
    try {
      let parsedHeaders: Record<string, string> = {};
      if (headers.trim()) parsedHeaders = JSON.parse(headers) as Record<string, string>;
      if (!url.trim() && channel)
        throw new Error('Enter the URL again to rotate or change alert configuration.');
      await apiRequest('/v1/alert-channel', {
        method: 'PUT',
        body: JSON.stringify({
          url,
          headers: parsedHeaders,
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
      setMessage('Alert channel saved. Send a test before relying on it.');
      await load();
    } catch (error) {
      setMessage(
        error instanceof SyntaxError || (error instanceof Error && !('status' in error))
          ? error.message
          : readableError(error),
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
        delivered: boolean;
        statusCode: number;
        latencyMs: number;
      }>('/v1/alert-channel/test', { method: 'POST' });
      setMessage(
        result.delivered
          ? `Test delivered · HTTP ${result.statusCode} · ${result.latencyMs} ms`
          : `Test failed · HTTP ${result.statusCode}`,
      );
    } catch (error) {
      setMessage(readableError(error));
    } finally {
      setBusy('');
    }
  }

  return (
    <details className="ht-alert-panel">
      <summary>
        <span>
          <b>Outgoing incident alerts</b>
          <small>
            {channel
              ? `${channel.displayHost} · ${channel.active ? 'active' : 'paused'}`
              : 'Not configured'}
          </small>
        </span>
        <span>ONE WEBHOOK CHANNEL</span>
      </summary>
      <form onSubmit={(event) => void save(event)}>
        <p>
          HookTrials sends a redacted JSON notification when an incident opens or recovers. This
          channel is separate from managed webhook destinations.
        </p>
        <div className="ht-monitor-form-grid">
          <label className="ht-field ht-field-wide">
            Alert URL {channel ? '(enter again only when updating)' : ''}
            <input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required={!channel}
              placeholder={
                channel
                  ? `Encrypted · ${channel.displayHost}`
                  : 'https://alerts.example.com/hooktrials'
              }
            />
          </label>
          <label className="ht-field ht-field-wide">
            Headers (optional, write-only JSON)
            <textarea
              value={headers}
              onChange={(event) => setHeaders(event.target.value)}
              placeholder='{"authorization":"Bearer …"}'
            />
          </label>
          <label className="ht-field">
            <span>
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />{' '}
              Channel active
            </span>
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
                value={cidrs}
                onChange={(event) => setCidrs(event.target.value)}
                required
                placeholder="10.0.0.0/24"
              />
            ) : null}
          </div>
        ) : null}
        {message ? (
          <p className="ht-form-success" role="status">
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
