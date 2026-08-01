import { useState, type FormEvent } from 'react';
import { apiRequest, readableError } from '../../../lib/api';
import type { MonitorSummary } from '../../../lib/types';

export function MonitorForm({
  selfHosted,
  monitor,
  onSaved,
}: {
  selfHosted: boolean;
  monitor?: MonitorSummary;
  onSaved(id: string): Promise<void>;
}) {
  const [name, setName] = useState(monitor?.name ?? '');
  const [url, setUrl] = useState('');
  const [protocol, setProtocol] = useState(monitor?.protocol ?? 'http');
  const [resourceType, setResourceType] = useState(monitor?.resourceType ?? 'external_api');
  const [environment, setEnvironment] = useState(monitor?.environment ?? 'test');
  const [method, setMethod] = useState(monitor?.method ?? 'GET');
  const [intervalSeconds, setIntervalSeconds] = useState(String(monitor?.intervalSeconds ?? 300));
  const [timeoutMs, setTimeoutMs] = useState(String(monitor?.timeoutMs ?? 10000));
  const [expectedMinStatus, setExpectedMinStatus] = useState(
    String(monitor?.expectedMinStatus ?? 200),
  );
  const [expectedMaxStatus, setExpectedMaxStatus] = useState(
    String(monitor?.expectedMaxStatus ?? 299),
  );
  const [expectedText, setExpectedText] = useState(monitor?.expectedText ?? '');
  const [expectedJsonPath, setExpectedJsonPath] = useState(monitor?.expectedJsonPath ?? '');
  const [headers, setHeaders] = useState('');
  const [clearHeaders, setClearHeaders] = useState(false);
  const [failureThreshold, setFailureThreshold] = useState(
    String(monitor?.consecutiveFailuresToOpen ?? 2),
  );
  const [sloTarget, setSloTarget] = useState(String(monitor?.sloTarget ?? 99.9));
  const [sloWindowDays, setSloWindowDays] = useState(String(monitor?.sloWindowDays ?? 7));
  const [allowPrivate, setAllowPrivate] = useState(monitor?.allowPrivateNetworks ?? false);
  const [privateCidrs, setPrivateCidrs] = useState(monitor?.allowedPrivateCidrs.join(', ') ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    try {
      let parsedHeaders: Record<string, string> = {};
      if (headers.trim()) {
        const value = JSON.parse(headers) as unknown;
        if (!value || typeof value !== 'object' || Array.isArray(value))
          throw new Error('Headers must be a JSON object.');
        parsedHeaders = value as Record<string, string>;
      }
      const payload = {
        name,
        protocol,
        resourceType,
        environment,
        ...(!monitor || url.trim() ? { url } : {}),
        method,
        intervalSeconds: Number(intervalSeconds),
        timeoutMs: Number(timeoutMs),
        expectedMinStatus: Number(expectedMinStatus),
        expectedMaxStatus: Number(expectedMaxStatus),
        expectedText: expectedText || undefined,
        expectedJsonPath: expectedJsonPath || undefined,
        ...(!monitor || headers.trim() || clearHeaders ? { headers: parsedHeaders } : {}),
        consecutiveFailuresToOpen: Number(failureThreshold),
        sloTarget: Number(sloTarget),
        sloWindowDays: Number(sloWindowDays),
        allowPrivateNetworks: allowPrivate,
        allowedPrivateCidrs: allowPrivate
          ? privateCidrs
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          : [],
      };
      const response = await apiRequest<{ monitor: { id: string } }>(
        monitor ? `/v1/monitors/${monitor.id}` : '/v1/monitors',
        {
          method: monitor ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      await onSaved(response.monitor.id);
    } catch (requestError) {
      setFormError(
        requestError instanceof SyntaxError ||
          (requestError instanceof Error &&
            !(requestError instanceof TypeError) &&
            requestError.message === 'Headers must be a JSON object.')
          ? requestError.message
          : readableError(requestError),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="ht-monitor-create" onSubmit={(event) => void submit(event)}>
      <header>
        <div>
          <h2 id={monitor ? 'edit-monitor-title' : undefined}>
            {monitor ? 'Edit integration' : 'New integration'}
          </h2>
        </div>
        <span>Secrets encrypted at rest</span>
      </header>
      <div className="ht-monitor-form-grid">
        <label className="ht-field">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="GitHub API"
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label className="ht-field">
          Check type
          <select
            value={protocol}
            onChange={(event) => {
              const next = event.target.value as 'http' | 'icmp';
              setProtocol(next);
              setResourceType(next === 'icmp' ? 'icmp_host' : 'external_api');
              setUrl('');
            }}
          >
            <option value="http">HTTP / HTTPS</option>
            <option value="icmp">ICMP ping</option>
          </select>
        </label>
        <label className="ht-field">
          Resource type
          <select
            value={resourceType}
            disabled={protocol === 'icmp'}
            onChange={(event) =>
              setResourceType(event.target.value as MonitorSummary['resourceType'])
            }
          >
            {protocol === 'icmp' ? <option value="icmp_host">ICMP host</option> : null}
            {protocol === 'http' ? (
              <>
                <option value="external_api">External API</option>
                <option value="internal_api">Internal API</option>
                <option value="http_route">HTTP route</option>
                <option value="webhook_destination">Webhook destination</option>
              </>
            ) : null}
          </select>
        </label>
        <label className="ht-field">
          Environment
          <select
            value={environment}
            onChange={(event) =>
              setEnvironment(event.target.value as MonitorSummary['environment'])
            }
          >
            <option value="test">Test</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </label>
        <label className="ht-field ht-field-wide">
          {protocol === 'icmp' ? 'Hostname or IP' : 'Target URL'}
          <input
            type={protocol === 'icmp' ? 'text' : 'url'}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={
              protocol === 'icmp' ? 'service.example.com' : 'https://api.example.com/health'
            }
            required={!monitor || protocol !== monitor.protocol}
          />
          <small>
            {monitor && !url
              ? `Current target: ${monitor.displayUrl}. Leave blank to keep it unchanged.`
              : protocol === 'icmp'
                ? 'Cloud permits publicly routable hosts only. ICMP must be enabled by the target network.'
                : 'Cloud permits public HTTPS targets only. Query values remain encrypted and are hidden from UI.'}
          </small>
        </label>
        <label className="ht-field">
          Frequency
          <select
            value={intervalSeconds}
            onChange={(event) => setIntervalSeconds(event.target.value)}
          >
            <option value="60">Every minute</option>
            <option value="300">Every 5 minutes</option>
            <option value="900">Every 15 minutes</option>
          </select>
        </label>
        <label className="ht-field">
          Timeout (ms)
          <input
            type="number"
            min="1000"
            max="30000"
            step="500"
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(event.target.value)}
          />
        </label>
        <label className="ht-field">
          Failures before Down
          <input
            type="number"
            min="1"
            max="10"
            value={failureThreshold}
            onChange={(event) => setFailureThreshold(event.target.value)}
          />
        </label>
        <label className="ht-field">
          Availability objective (%)
          <input
            type="number"
            min="90"
            max="100"
            step="0.01"
            value={sloTarget}
            onChange={(event) => setSloTarget(event.target.value)}
          />
          <small>Used to calculate the rolling error budget.</small>
        </label>
        <label className="ht-field">
          Objective window
          <select value={sloWindowDays} onChange={(event) => setSloWindowDays(event.target.value)}>
            <option value="1">24 hours</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
          <small>Alerts start after five recorded checks.</small>
        </label>
        {protocol === 'http' ? (
          <>
            <label className="ht-field">
              Method
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as MonitorSummary['method'])}
              >
                <option>GET</option>
                <option>HEAD</option>
                <option>POST</option>
              </select>
            </label>
            <label className="ht-field">
              Expected status from
              <input
                type="number"
                min="100"
                max="599"
                value={expectedMinStatus}
                onChange={(event) => setExpectedMinStatus(event.target.value)}
              />
            </label>
            <label className="ht-field">
              Expected status to
              <input
                type="number"
                min="100"
                max="599"
                value={expectedMaxStatus}
                onChange={(event) => setExpectedMaxStatus(event.target.value)}
              />
            </label>
            <label className="ht-field">
              Expected text (optional)
              <input
                value={expectedText}
                onChange={(event) => setExpectedText(event.target.value)}
                placeholder="operational"
                maxLength={256}
              />
            </label>
            <label className="ht-field">
              JSON path (optional)
              <input
                value={expectedJsonPath}
                onChange={(event) => setExpectedJsonPath(event.target.value)}
                placeholder="$.data.ready"
              />
            </label>
            <label className="ht-field ht-field-wide">
              Authentication headers (optional JSON)
              <textarea
                value={headers}
                onChange={(event) => setHeaders(event.target.value)}
                placeholder='{"authorization":"Bearer …"}'
              />
              <small>Values are write-only after creation and never returned by API.</small>
              {monitor?.hasAuthenticationHeaders ? (
                <label className="ht-inline-check">
                  <input
                    type="checkbox"
                    checked={clearHeaders}
                    onChange={(event) => setClearHeaders(event.target.checked)}
                  />{' '}
                  Remove stored authentication headers
                </label>
              ) : null}
            </label>
          </>
        ) : null}
      </div>
      {selfHosted ? (
        <div className="ht-private-monitor">
          <label>
            <input
              type="checkbox"
              checked={allowPrivate}
              onChange={(event) => setAllowPrivate(event.target.checked)}
            />{' '}
            Monitor explicitly allowed private network
          </label>
          {allowPrivate ? (
            <label className="ht-field">
              Allowed CIDRs
              <input
                value={privateCidrs}
                onChange={(event) => setPrivateCidrs(event.target.value)}
                placeholder="10.20.0.0/16, 192.168.50.0/24"
                required
              />
              <small>
                HTTP and private destinations become available only inside these ranges.
              </small>
            </label>
          ) : null}
        </div>
      ) : null}
      {formError ? (
        <p className="ht-form-error" role="alert">
          {formError}
        </p>
      ) : null}
      <button type="submit" className="button primary" disabled={submitting}>
        {submitting ? 'Validating target…' : monitor ? 'Save changes' : 'Create monitor'}
      </button>
    </form>
  );
}
