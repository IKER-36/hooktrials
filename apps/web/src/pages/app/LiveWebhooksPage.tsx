import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, RadioTower, ShieldCheck, Waypoints } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CopyButton } from '../../components/ui/CopyButton';
import { useI18n } from '../../i18n/I18nContext';
import { useDashboard } from '../../layouts/AppLayout';
import { readableError } from '../../lib/api';
import type { Endpoint } from '../../lib/types';

type Provider = NonNullable<Endpoint['provider']>;

const PROVIDERS: Array<{ id: Provider; name: string; detail: string }> = [
  { id: 'generic', name: 'Generic', detail: 'Any HTTPS webhook provider' },
  { id: 'stripe', name: 'Stripe', detail: 'Native Stripe-Signature verification' },
  { id: 'github', name: 'GitHub', detail: 'Native X-Hub-Signature-256 verification' },
  { id: 'shopify', name: 'Shopify', detail: 'Topic and delivery header contract' },
  { id: 'slack', name: 'Slack', detail: 'Timestamp and signature header contract' },
];

function providerContract(provider: Provider) {
  const requiredHeaders: Record<string, string> = {};
  if (provider === 'stripe') requiredHeaders['stripe-signature'] = '';
  if (provider === 'github') {
    requiredHeaders['x-github-event'] = '';
    requiredHeaders['x-github-delivery'] = '';
    requiredHeaders['x-hub-signature-256'] = '';
  }
  if (provider === 'shopify') {
    requiredHeaders['x-shopify-topic'] = '';
    requiredHeaders['x-shopify-webhook-id'] = '';
    requiredHeaders['x-shopify-hmac-sha256'] = '';
  }
  if (provider === 'slack') {
    requiredHeaders['x-slack-request-timestamp'] = '';
    requiredHeaders['x-slack-signature'] = '';
  }
  return { method: 'POST', requiredHeaders, jsonPaths: {} };
}

export function LiveWebhooksPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { endpoints, scenarios, limits, loading, createEndpoint, updateEndpoint, selectEndpoint } =
    useDashboard();
  const [provider, setProvider] = useState<Provider>('generic');
  const [name, setName] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [mode, setMode] = useState<'observe' | 'protect'>('observe');
  const [environment, setEnvironment] = useState<'test' | 'staging' | 'production'>('test');
  const [signatureSecret, setSignatureSecret] = useState('');
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Endpoint | null>(null);
  const [activationSecret, setActivationSecret] = useState('');
  const [activatingSignature, setActivatingSignature] = useState(false);
  const [activationError, setActivationError] = useState('');

  const liveRoutes = useMemo(
    () => endpoints.filter((endpoint) => endpoint.mode !== 'trial' && !endpoint.demoOwned),
    [endpoints],
  );
  const limit = limits?.endpoints ?? 0;
  const usage = limits?.endpointUsage ?? endpoints.filter((endpoint) => !endpoint.demoOwned).length;
  const atLimit = limit > 0 && usage >= limit;
  const supportsSignature = provider === 'stripe' || provider === 'github';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scenario = scenarios[0];
    if (!scenario) return;
    setSubmitting(true);
    setError('');
    setCreated(null);
    try {
      const endpoint = await createEndpoint(name.trim(), scenario.id, {
        provider,
        mode,
        environment,
        destinationUrl: destinationUrl.trim(),
        contract: providerContract(provider),
        signatureProvider: supportsSignature && signatureSecret.trim() ? provider : 'none',
        ...(supportsSignature && signatureSecret.trim()
          ? { signatureSecret: signatureSecret.trim() }
          : {}),
        confirmProductionImpact: environment === 'production' ? confirmProduction : false,
      });
      setCreated(endpoint);
      setName('');
      setDestinationUrl('');
      setSignatureSecret('');
      setConfirmProduction(false);
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  async function enableSignature(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!created || (created.provider !== 'stripe' && created.provider !== 'github')) return;
    setActivatingSignature(true);
    setActivationError('');
    try {
      const updated = await updateEndpoint(created, {
        signatureProvider: created.provider,
        signatureSecret: activationSecret.trim(),
      });
      setCreated(updated);
      setActivationSecret('');
    } catch (requestError) {
      setActivationError(readableError(requestError));
    } finally {
      setActivatingSignature(false);
    }
  }

  function openRoute(endpoint: Endpoint) {
    selectEndpoint(endpoint.id);
    navigate('/app');
  }

  return (
    <section className="ht-page ht-live-webhooks">
      <header className="ht-page-head ht-live-head">
        <div>
          <p className="ht-kicker">Live traffic</p>
          <h1>Webhook Hub</h1>
          <p className="ht-muted-line">
            Put HookTrials between every provider and your backend. Inspect the complete request,
            validate it and forward it with an auditable delivery trail.
          </p>
        </div>
        <div className="ht-live-summary" aria-label="Live webhook summary">
          <strong>{liveRoutes.length}</strong>
          <span>live routes</span>
          <i />
          <strong>{liveRoutes.filter((route) => route.mode === 'protect').length}</strong>
          <span>protected</span>
        </div>
      </header>

      <section className="ht-live-flow" aria-label="Webhook traffic flow">
        <article>
          <RadioTower aria-hidden="true" />
          <span>1</span>
          <div>
            <b>Provider sends</b>
            <small>Stripe, GitHub, Shopify, Slack or any service</small>
          </div>
        </article>
        <ArrowRight aria-hidden="true" />
        <article className="active">
          <Waypoints aria-hidden="true" />
          <span>2</span>
          <div>
            <b>HookTrials intercepts</b>
            <small>Capture, signature, contract and delivery evidence</small>
          </div>
        </article>
        <ArrowRight aria-hidden="true" />
        <article>
          <ShieldCheck aria-hidden="true" />
          <span>3</span>
          <div>
            <b>Your backend receives</b>
            <small>Forward once or deliver durably with retries</small>
          </div>
        </article>
      </section>

      <div className="ht-live-grid">
        <form className="ht-live-connect" onSubmit={(event) => void submit(event)}>
          <header>
            <p className="ht-kicker">New live connection</p>
            <h2>Connect a real webhook</h2>
            <p>
              HookTrials gives you one public URL. Replace the destination in your provider and all
              traffic will pass through the reliability hub.
            </p>
          </header>

          <fieldset className="ht-provider-choice">
            <legend>Provider</legend>
            {PROVIDERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={provider === item.id ? 'active' : ''}
                onClick={() => setProvider(item.id)}
              >
                <b>{item.name}</b>
                <small>{item.detail}</small>
              </button>
            ))}
          </fieldset>

          <div className="ht-monitor-form-grid">
            <label className="ht-field">
              Connection name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="stripe-payments-production"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            <label className="ht-field">
              Environment
              <select
                value={environment}
                onChange={(event) =>
                  setEnvironment(event.target.value as 'test' | 'staging' | 'production')
                }
              >
                <option value="test">Test</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="ht-field ht-field-wide">
              Your current webhook destination
              <input
                type="url"
                value={destinationUrl}
                onChange={(event) => setDestinationUrl(event.target.value)}
                placeholder="https://api.example.com/webhooks/payments"
                required
              />
              <small>Encrypted at rest and never returned to the browser.</small>
            </label>
          </div>

          <fieldset className="ht-delivery-choice">
            <legend>Delivery strategy</legend>
            <label className={mode === 'observe' ? 'active' : ''}>
              <input
                type="radio"
                name="mode"
                value="observe"
                checked={mode === 'observe'}
                onChange={() => setMode('observe')}
              />
              <b>Observe</b>
              <span>Forward synchronously and return your backend response to the provider.</span>
            </label>
            <label className={mode === 'protect' ? 'active' : ''}>
              <input
                type="radio"
                name="mode"
                value="protect"
                checked={mode === 'protect'}
                onChange={() => setMode('protect')}
              />
              <b>Protect</b>
              <span>Accept first, queue durably and retry safely if your backend is down.</span>
            </label>
          </fieldset>

          {supportsSignature ? (
            <label className="ht-field">
              {provider === 'stripe'
                ? 'Stripe endpoint signing secret (optional now)'
                : 'GitHub webhook secret (optional now)'}
              <input
                type="password"
                value={signatureSecret}
                onChange={(event) => setSignatureSecret(event.target.value)}
                placeholder={provider === 'stripe' ? 'whsec_…' : 'At least 8 characters'}
                minLength={8}
              />
              <small>
                Write-only and encrypted. You can add it after the provider has accepted the new
                HookTrials URL.
              </small>
            </label>
          ) : null}

          {environment === 'production' ? (
            <label className="ht-production-confirm">
              <input
                type="checkbox"
                checked={confirmProduction}
                onChange={(event) => setConfirmProduction(event.target.checked)}
                required
              />
              <span>
                I understand that this route becomes part of the production delivery path and my
                destination must handle idempotency.
              </span>
            </label>
          ) : null}

          {error ? <p className="ht-form-error">{error}</p> : null}
          {atLimit ? (
            <p className="ht-form-note">Hosted limit reached — remove an endpoint first.</p>
          ) : null}
          <button
            className="button primary"
            type="submit"
            disabled={submitting || loading || atLimit || scenarios.length === 0}
          >
            {submitting ? 'Creating secure route…' : 'Create live connection'}
          </button>
        </form>

        <aside className="ht-live-activation">
          <p className="ht-kicker">Activation</p>
          <h2>{created ? 'Your route is ready' : 'What happens next'}</h2>
          {created?.ingestUrl ? (
            <>
              <div className="ht-route-ready">
                <CheckCircle2 aria-hidden="true" />
                <div>
                  <b>{created.name}</b>
                  <span>
                    {t(created.mode === 'observe' ? 'Observe' : 'Protect')} ·{' '}
                    {t('ready to receive')}
                  </span>
                </div>
              </div>
              <label className="ht-field">
                Public HookTrials URL
                <div className="ht-ingest-copy">
                  <code>{created.ingestUrl}</code>
                  <CopyButton value={created.ingestUrl} label="Copy URL" />
                </div>
              </label>
              <ol>
                <li>
                  {t('Open the webhook settings in')}{' '}
                  {PROVIDERS.find((item) => item.id === created.provider)?.name ??
                    t('your provider')}
                  .
                </li>
                <li>Replace the current URL with the HookTrials URL above.</li>
                <li>Send a test event and open the connection to inspect the complete journey.</li>
              </ol>
              {(created.provider === 'stripe' || created.provider === 'github') &&
              !created.signatureConfigured ? (
                <form
                  className="ht-signature-activation"
                  onSubmit={(event) => void enableSignature(event)}
                >
                  <b>Finish signature verification</b>
                  <p>
                    After registering the HookTrials URL, paste the provider signing secret here.
                    Incoming traffic remains visible, but it is not cryptographically verified until
                    this step is complete.
                  </p>
                  <input
                    type="password"
                    value={activationSecret}
                    onChange={(event) => setActivationSecret(event.target.value)}
                    placeholder={
                      created.provider === 'stripe' ? 'whsec_…' : 'GitHub webhook secret'
                    }
                    minLength={8}
                    required
                  />
                  {activationError ? (
                    <span className="ht-form-error">{activationError}</span>
                  ) : null}
                  <button className="button secondary" type="submit" disabled={activatingSignature}>
                    {activatingSignature ? 'Enabling…' : 'Enable signature verification'}
                  </button>
                </form>
              ) : null}
              <button className="button secondary" type="button" onClick={() => openRoute(created)}>
                Open live inspector
              </button>
            </>
          ) : (
            <ol className="ht-activation-steps">
              <li>
                <b>Create the route</b>
                <span>Choose a provider, your real destination and a delivery strategy.</span>
              </li>
              <li>
                <b>Copy one public URL</b>
                <span>Paste it into the provider instead of your current backend URL.</span>
              </li>
              <li>
                <b>Watch real traffic</b>
                <span>
                  Inspect requests, validation, destination responses, retries and recovery.
                </span>
              </li>
            </ol>
          )}
          <div className="ht-live-security-note">
            <ShieldCheck aria-hidden="true" />
            <p>
              Payloads and secrets are encrypted at rest. Private network destinations remain
              blocked in HookTrials Cloud.
            </p>
          </div>
        </aside>
      </div>

      <section className="ht-live-routes">
        <header>
          <div>
            <p className="ht-kicker">Concentrator</p>
            <h2>Live connections</h2>
          </div>
          <p>One control plane for every provider and backend.</p>
        </header>
        {liveRoutes.length === 0 ? (
          <div className="ht-events-empty">
            <h3>No live routes yet.</h3>
            <p>Create the first connection above. Trial endpoints remain separate and safe.</p>
          </div>
        ) : (
          <div className="ht-live-route-list">
            {liveRoutes.map((endpoint) => (
              <article key={endpoint.id}>
                <span className={`ht-listen ${endpoint.active ? 'on' : 'off'}`}>
                  <i /> {endpoint.active ? 'LIVE' : 'PAUSED'}
                </span>
                <div className="ht-live-route-title">
                  <strong>{endpoint.name}</strong>
                  <small>
                    {PROVIDERS.find((item) => item.id === endpoint.provider)?.name ?? 'Generic'} ·{' '}
                    {endpoint.environment}
                  </small>
                </div>
                <div className="ht-route-mini-flow">
                  <span>
                    {PROVIDERS.find((item) => item.id === endpoint.provider)?.name ?? 'Provider'}
                  </span>
                  <ArrowRight />
                  <b>HookTrials</b>
                  <ArrowRight />
                  <span>{endpoint.destinationHost ?? 'destination'}</span>
                </div>
                <span className={`ht-mode-badge ${endpoint.mode}`}>{endpoint.mode}</span>
                <button type="button" onClick={() => openRoute(endpoint)}>
                  Inspect
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
