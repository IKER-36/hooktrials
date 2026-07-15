import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../layouts/AppLayout';
import { readableError } from '../../lib/api';
import type { Endpoint } from '../../lib/types';

const PROVIDER_PRESETS = [
  {
    id: 'stripe',
    name: 'Stripe',
    provider: 'stripe' as const,
    headers: { 'stripe-signature': '' },
    note: 'Native signature verification · add your whsec_ secret',
  },
  {
    id: 'github',
    name: 'GitHub',
    provider: 'github' as const,
    headers: { 'x-github-event': '', 'x-github-delivery': '', 'x-hub-signature-256': '' },
    note: 'Native X-Hub-Signature-256 verification',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    provider: 'none' as const,
    headers: { 'x-shopify-topic': '', 'x-shopify-webhook-id': '', 'x-shopify-hmac-sha256': '' },
    note: 'Contract starter · HMAC header presence captured',
  },
  {
    id: 'slack',
    name: 'Slack',
    provider: 'none' as const,
    headers: { 'x-slack-request-timestamp': '', 'x-slack-signature': '' },
    note: 'Contract starter · signing headers captured',
  },
] as const;

export function RouteConfiguration({ endpoint }: { endpoint: Endpoint }) {
  const { setup } = useAuth();
  const { updateEndpoint } = useDashboard();
  const [mode, setMode] = useState(endpoint.mode);
  const [environment, setEnvironment] = useState(endpoint.environment);
  const [destinationUrl, setDestinationUrl] = useState('');
  const [headers, setHeaders] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(String(endpoint.destinationTimeoutMs ?? 10_000));
  const [retryMaxAttempts, setRetryMaxAttempts] = useState(String(endpoint.retryMaxAttempts ?? 5));
  const [retryBaseDelayMs, setRetryBaseDelayMs] = useState(
    String(endpoint.retryBaseDelayMs ?? 2_000),
  );
  const [retryMaxDelayMs, setRetryMaxDelayMs] = useState(
    String(endpoint.retryMaxDelayMs ?? 300_000),
  );
  const [contractMethod, setContractMethod] = useState('');
  const [contractHeaders, setContractHeaders] = useState('');
  const [contractJsonPaths, setContractJsonPaths] = useState('');
  const [removeContract, setRemoveContract] = useState(false);
  const [signatureProvider, setSignatureProvider] = useState(endpoint.signatureProvider ?? 'none');
  const [signatureSecret, setSignatureSecret] = useState('');
  const [signatureTolerance, setSignatureTolerance] = useState(
    String(endpoint.signatureToleranceSeconds ?? 300),
  );
  const [expectedMinStatus, setExpectedMinStatus] = useState(
    String(endpoint.destinationExpectedMinStatus ?? 200),
  );
  const [expectedMaxStatus, setExpectedMaxStatus] = useState(
    String(endpoint.destinationExpectedMaxStatus ?? 299),
  );
  const [allowPrivate, setAllowPrivate] = useState(endpoint.allowPrivateNetworks ?? false);
  const [privateCidrs, setPrivateCidrs] = useState((endpoint.allowedPrivateCidrs ?? []).join(', '));
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  function applyProviderPreset(preset: (typeof PROVIDER_PRESETS)[number]) {
    setActivePreset(preset.id);
    setSignatureProvider(preset.provider);
    setContractMethod('POST');
    setContractHeaders(JSON.stringify(preset.headers, null, 2));
    setContractJsonPaths('');
    setRemoveContract(false);
    setSaved(false);
    setError('');
  }

  useEffect(() => {
    setMode(endpoint.mode);
    setEnvironment(endpoint.environment);
    setTimeoutMs(String(endpoint.destinationTimeoutMs ?? 10_000));
    setRetryMaxAttempts(String(endpoint.retryMaxAttempts ?? 5));
    setRetryBaseDelayMs(String(endpoint.retryBaseDelayMs ?? 2_000));
    setRetryMaxDelayMs(String(endpoint.retryMaxDelayMs ?? 300_000));
    setSignatureProvider(endpoint.signatureProvider ?? 'none');
    setSignatureTolerance(String(endpoint.signatureToleranceSeconds ?? 300));
    setExpectedMinStatus(String(endpoint.destinationExpectedMinStatus ?? 200));
    setExpectedMaxStatus(String(endpoint.destinationExpectedMaxStatus ?? 299));
    setAllowPrivate(endpoint.allowPrivateNetworks ?? false);
    setPrivateCidrs((endpoint.allowedPrivateCidrs ?? []).join(', '));
  }, [endpoint]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      if (mode !== 'trial' && !endpoint.destinationConfigured && !destinationUrl.trim()) {
        throw new Error('A destination URL is required for Observe mode.');
      }
      let parsedHeaders: Record<string, string> | undefined;
      if (headers.trim()) {
        const parsed = JSON.parse(headers) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Destination headers must be a JSON object.');
        }
        parsedHeaders = parsed as Record<string, string>;
      }
      let requiredHeaders: Record<string, string> = {};
      let jsonPaths: Record<string, string | number | boolean | null> = {};
      if (contractHeaders.trim())
        requiredHeaders = JSON.parse(contractHeaders) as Record<string, string>;
      if (contractJsonPaths.trim())
        jsonPaths = JSON.parse(contractJsonPaths) as Record<
          string,
          string | number | boolean | null
        >;
      const contractChanged = Boolean(
        contractMethod || contractHeaders.trim() || contractJsonPaths.trim(),
      );
      if (
        signatureProvider !== 'none' &&
        !endpoint.signatureConfigured &&
        !signatureSecret.trim()
      ) {
        throw new Error('Enter the provider signing secret before enabling verification.');
      }
      await updateEndpoint(endpoint, {
        mode,
        environment,
        destinationTimeoutMs: Number(timeoutMs),
        retryMaxAttempts: Number(retryMaxAttempts),
        retryBaseDelayMs: Number(retryBaseDelayMs),
        retryMaxDelayMs: Number(retryMaxDelayMs),
        destinationExpectedMinStatus: Number(expectedMinStatus),
        destinationExpectedMaxStatus: Number(expectedMaxStatus),
        ...(removeContract
          ? { contract: null }
          : contractChanged
            ? { contract: { method: contractMethod || undefined, requiredHeaders, jsonPaths } }
            : {}),
        signatureProvider,
        ...(signatureProvider === 'none'
          ? { signatureSecret: null }
          : signatureSecret.trim()
            ? { signatureSecret: signatureSecret.trim() }
            : {}),
        signatureToleranceSeconds: Number(signatureTolerance),
        ...(destinationUrl.trim() ? { destinationUrl: destinationUrl.trim() } : {}),
        ...(parsedHeaders ? { destinationHeaders: parsedHeaders } : {}),
        allowPrivateNetworks: setup?.deploymentMode === 'selfhost' ? allowPrivate : false,
        allowedPrivateCidrs:
          setup?.deploymentMode === 'selfhost' && allowPrivate
            ? privateCidrs
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
        confirmProductionImpact: confirmProduction,
      });
      setDestinationUrl('');
      setHeaders('');
      setContractMethod('');
      setContractHeaders('');
      setContractJsonPaths('');
      setRemoveContract(false);
      setSignatureSecret('');
      setConfirmProduction(false);
      setSaved(true);
    } catch (requestError) {
      setError(
        requestError instanceof SyntaxError ||
          (requestError instanceof Error && !('status' in requestError))
          ? requestError.message
          : readableError(requestError),
      );
    } finally {
      setSaving(false);
    }
  }

  const productionNeedsConfirmation =
    environment === 'production' && mode !== 'trial' && !endpoint.productionConfirmedAt;

  return (
    <details className="ht-route-config" open={endpoint.mode !== 'trial'}>
      <summary>
        <span>
          <b>Route control</b>
          <small>
            {endpoint.mode.toUpperCase()} · {endpoint.environment}
          </small>
        </span>
        <span>{endpoint.destinationHost ?? 'No destination'}</span>
      </summary>
      <form onSubmit={(event) => void submit(event)}>
        <div className="ht-route-mode-help">
          <article className={mode === 'trial' ? 'active' : ''}>
            <b>TRIAL</b>
            <span>Return deterministic failures. Nothing reaches your backend.</span>
          </article>
          <article className={mode === 'observe' ? 'active' : ''}>
            <b>OBSERVE</b>
            <span>Forward once, mirror the result and diagnose each side.</span>
          </article>
          <article className={mode === 'protect' ? 'active' : ''}>
            <b>PROTECT</b>
            <span>Durable queue, retries and dead-letter recovery.</span>
          </article>
        </div>
        <div className="ht-monitor-form-grid">
          <label className="ht-field">
            Mode
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as Endpoint['mode'])}
            >
              <option value="trial">Trial</option>
              <option value="observe">Observe</option>
              <option value="protect">Protect</option>
            </select>
          </label>
          <label className="ht-field">
            Environment
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as Endpoint['environment'])}
            >
              <option value="test">Test</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </label>
          {mode === 'protect' ? (
            <>
              <label className="ht-field">
                Maximum attempts
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={retryMaxAttempts}
                  onChange={(event) => setRetryMaxAttempts(event.target.value)}
                />
              </label>
              <label className="ht-field">
                Initial retry delay (ms)
                <input
                  type="number"
                  min="1000"
                  max="300000"
                  step="1000"
                  value={retryBaseDelayMs}
                  onChange={(event) => setRetryBaseDelayMs(event.target.value)}
                />
              </label>
              <label className="ht-field">
                Maximum retry delay (ms)
                <input
                  type="number"
                  min="5000"
                  max="3600000"
                  step="1000"
                  value={retryMaxDelayMs}
                  onChange={(event) => setRetryMaxDelayMs(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="ht-field ht-field-wide">
            Destination URL {endpoint.destinationConfigured ? '(leave blank to keep current)' : ''}
            <input
              type="url"
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
              placeholder={
                endpoint.destinationHost
                  ? `Encrypted · ${endpoint.destinationHost}`
                  : 'https://backend.example.com/webhooks'
              }
            />
            <small>
              Stored encrypted. Query values and credentials are never returned to the browser.
            </small>
          </label>
          <label className="ht-field">
            Destination timeout (ms)
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
            Healthy destination status from
            <input
              type="number"
              min="100"
              max="599"
              value={expectedMinStatus}
              onChange={(event) => setExpectedMinStatus(event.target.value)}
            />
          </label>
          <label className="ht-field">
            Healthy destination status to
            <input
              type="number"
              min="100"
              max="599"
              value={expectedMaxStatus}
              onChange={(event) => setExpectedMaxStatus(event.target.value)}
            />
          </label>
          <label className="ht-field ht-field-wide">
            Destination-only headers (optional JSON)
            <textarea
              value={headers}
              onChange={(event) => setHeaders(event.target.value)}
              placeholder='{"authorization":"Bearer …"}'
            />
            <small>Write-only. These override matching provider headers.</small>
          </label>
        </div>
        <section className="ht-route-security">
          <header>
            <div>
              <p className="ht-kicker">Integrity gate</p>
              <h3>Signature and inbound contract</h3>
            </div>
            <span>
              {endpoint.signatureConfigured ? 'Secret encrypted' : 'No signing secret'} ·{' '}
              {endpoint.contractConfigured ? 'Contract active' : 'No contract'}
            </span>
          </header>
          <div className="ht-provider-presets" aria-label="Provider presets">
            {PROVIDER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={activePreset === preset.id ? 'active' : ''}
                onClick={() => applyProviderPreset(preset)}
              >
                <b>{preset.name}</b>
                <small>{preset.note}</small>
              </button>
            ))}
          </div>
          {activePreset ? (
            <p className="ht-provider-note" role="status">
              {activePreset === 'stripe' || activePreset === 'github'
                ? 'Preset applied. Enter the provider signing secret, review the contract, then save.'
                : 'Contract starter applied. Header presence will be verified; native signature verification currently supports Stripe and GitHub.'}
            </p>
          ) : null}
          <div className="ht-monitor-form-grid">
            <label className="ht-field">
              Provider signature preset
              <select
                value={signatureProvider}
                onChange={(event) =>
                  setSignatureProvider(event.target.value as 'none' | 'github' | 'stripe')
                }
              >
                <option value="none">None</option>
                <option value="github">GitHub · X-Hub-Signature-256</option>
                <option value="stripe">Stripe · Stripe-Signature</option>
              </select>
            </label>
            <label className="ht-field">
              Signing secret {endpoint.signatureConfigured ? '(leave blank to keep)' : ''}
              <input
                type="password"
                value={signatureSecret}
                onChange={(event) => setSignatureSecret(event.target.value)}
                placeholder={
                  endpoint.signatureConfigured
                    ? 'Encrypted · unchanged'
                    : 'whsec_… or GitHub secret'
                }
              />
            </label>
            {signatureProvider === 'stripe' ? (
              <label className="ht-field">
                Stripe timestamp tolerance (seconds)
                <input
                  type="number"
                  min="30"
                  max="3600"
                  value={signatureTolerance}
                  onChange={(event) => setSignatureTolerance(event.target.value)}
                />
              </label>
            ) : null}
            <label className="ht-field">
              Expected inbound method
              <select
                value={contractMethod}
                onChange={(event) => setContractMethod(event.target.value)}
              >
                <option value="">Any method</option>
                {['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => (
                  <option key={method}>{method}</option>
                ))}
              </select>
            </label>
            <label className="ht-field ht-field-wide">
              Required headers (optional JSON)
              <textarea
                value={contractHeaders}
                onChange={(event) => setContractHeaders(event.target.value)}
                placeholder='{"x-github-event":"push","x-required-header":""}'
              />
              <small>
                An empty expected value requires presence only. Values are encrypted and write-only.
              </small>
            </label>
            <label className="ht-field ht-field-wide">
              Required JSON paths (optional JSON)
              <textarea
                value={contractJsonPaths}
                onChange={(event) => setContractJsonPaths(event.target.value)}
                placeholder='{"$.action":"created","$.data.ready":true}'
              />
            </label>
          </div>
          {endpoint.contractConfigured ? (
            <label className="ht-remove-contract">
              <input
                type="checkbox"
                checked={removeContract}
                onChange={(event) => setRemoveContract(event.target.checked)}
              />{' '}
              Remove the current encrypted contract
            </label>
          ) : null}
        </section>
        {setup?.deploymentMode === 'selfhost' ? (
          <div className="ht-private-monitor">
            <label>
              <input
                type="checkbox"
                checked={allowPrivate}
                onChange={(event) => setAllowPrivate(event.target.checked)}
              />{' '}
              Allow this route to reach explicit private CIDRs
            </label>
            {allowPrivate ? (
              <input
                value={privateCidrs}
                onChange={(event) => setPrivateCidrs(event.target.value)}
                placeholder="10.0.0.0/24, 172.20.0.0/16"
                required
              />
            ) : null}
          </div>
        ) : null}
        {productionNeedsConfirmation ? (
          <label className="ht-production-confirm">
            <input
              type="checkbox"
              checked={confirmProduction}
              onChange={(event) => setConfirmProduction(event.target.checked)}
              required
            />
            I understand that production provider traffic will be forwarded through HookTrials and
            its response will come from my destination.
          </label>
        ) : null}
        {error ? (
          <p className="ht-form-error" role="alert">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="ht-form-success" role="status">
            Route configuration saved.
          </p>
        ) : null}
        <button className="button primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save route control'}
        </button>
      </form>
    </details>
  );
}
