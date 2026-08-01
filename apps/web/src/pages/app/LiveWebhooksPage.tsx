import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Building2,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  Network,
  RadioTower,
  ShieldCheck,
  Store,
  Waypoints,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CopyButton } from '../../components/ui/CopyButton';
import { ProductState } from '../../components/ui/ProductState';
import { PageHeader } from '../../components/ui/PageHeader';
import { WorkspaceJourney } from '../../components/app/WorkspaceJourney';
import { useI18n } from '../../i18n/I18nContext';
import { useDashboard } from '../../layouts/AppLayout';
import { apiRequest, readableError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { Endpoint, IntegrationSummary } from '../../lib/types';

type Provider = NonNullable<Endpoint['provider']>;
type PreflightCheck = {
  id: string;
  status: 'passed' | 'warning' | 'failed';
  detail: string;
};
type PreflightResult = {
  url: string;
  reachable: boolean;
  ready: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  checks: PreflightCheck[];
};
type TestEventResult = {
  accepted: boolean;
  eventId: string | null;
  correlationKey: string;
  mode: 'observe' | 'protect';
  statusCode: number;
  latencyMs: number;
  destinationTriggered: boolean;
};

type RouteFilter = 'all' | 'attention' | 'paused';

function readRouteFilter(value: string | null): RouteFilter {
  return value === 'attention' || value === 'paused' ? value : 'all';
}

// Lucide carries no brand marks, so each provider gets the line icon that best
// describes what it sends. Icons support the label; they never replace it.
const PROVIDERS: Array<{ id: Provider; name: string; detail: string; icon: LucideIcon }> = [
  { id: 'generic', name: 'Generic', detail: 'Any HTTPS webhook provider', icon: Webhook },
  {
    id: 'stripe',
    name: 'Stripe',
    detail: 'Native Stripe-Signature verification',
    icon: CreditCard,
  },
  {
    id: 'github',
    name: 'GitHub',
    detail: 'Native X-Hub-Signature-256 verification',
    icon: GitPullRequest,
  },
  { id: 'shopify', name: 'Shopify', detail: 'Topic and delivery header contract', icon: Store },
  {
    id: 'slack',
    name: 'Slack',
    detail: 'Timestamp and signature header contract',
    icon: MessageSquare,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    detail: 'Event, UUID and token contract',
    icon: GitBranch,
  },
  {
    id: 'linear',
    name: 'Linear',
    detail: 'Delivery and signature header contract',
    icon: Network,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    detail: 'Timestamp and signature header contract',
    icon: Building2,
  },
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
  if (provider === 'gitlab') {
    requiredHeaders['x-gitlab-event'] = '';
    requiredHeaders['x-gitlab-webhook-uuid'] = '';
    requiredHeaders['x-gitlab-token'] = '';
  }
  if (provider === 'linear') {
    requiredHeaders['linear-event'] = '';
    requiredHeaders['linear-delivery'] = '';
    requiredHeaders['linear-signature'] = '';
    requiredHeaders['linear-timestamp'] = '';
  }
  if (provider === 'hubspot') {
    requiredHeaders['x-hubspot-signature-v3'] = '';
    requiredHeaders['x-hubspot-request-timestamp'] = '';
  }
  return { method: 'POST', requiredHeaders, jsonPaths: {} };
}

function integrationTone(integration: IntegrationSummary | undefined, endpoint: Endpoint) {
  if (!endpoint.active || integration?.state === 'paused') return 'paused' as const;
  if (integration?.state === 'down' || integration?.incident?.status === 'open')
    return 'down' as const;
  if (integration?.state === 'degraded') return 'degraded' as const;
  if (integration?.state === 'healthy') return 'healthy' as const;
  return 'new' as const;
}

function integrationToneLabel(tone: ReturnType<typeof integrationTone>) {
  if (tone === 'healthy') return 'Healthy';
  if (tone === 'degraded') return 'Watch';
  if (tone === 'down') return 'Needs attention';
  if (tone === 'paused') return 'Paused';
  return 'No traffic yet';
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
  const [deliveryStrategy, setDeliveryStrategy] = useState<'single' | 'fanout' | 'failover'>(
    'single',
  );
  const [idempotencyScope, setIdempotencyScope] = useState<'destination' | 'event'>('destination');
  const [additionalDestinations, setAdditionalDestinations] = useState<
    Array<{ name: string; url: string }>
  >([]);
  const [signatureSecret, setSignatureSecret] = useState('');
  const [confirmProduction, setConfirmProduction] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Endpoint | null>(null);
  const [activationSecret, setActivationSecret] = useState('');
  const [activatingSignature, setActivatingSignature] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflighting, setPreflighting] = useState(false);
  const [preflightError, setPreflightError] = useState('');
  const [testingRouteId, setTestingRouteId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<
    { routeId: string; result?: TestEventResult; error?: string } | undefined
  >();
  const [integrationRows, setIntegrationRows] = useState<IntegrationSummary[]>([]);
  const [integrationLoading, setIntegrationLoading] = useState(true);
  const [integrationError, setIntegrationError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const routeFilter = readRouteFilter(searchParams.get('view'));
  const setRouteFilter = useCallback(
    (filter: RouteFilter) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (filter === 'all') next.delete('view');
          else next.set('view', filter);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const liveRoutes = useMemo(
    () => endpoints.filter((endpoint) => endpoint.mode !== 'trial'),
    [endpoints],
  );
  const syntheticRoutes = liveRoutes.filter((endpoint) => endpoint.demoOwned);
  const limit = limits?.endpoints ?? 0;
  const usage = limits?.endpointUsage ?? endpoints.filter((endpoint) => !endpoint.demoOwned).length;
  const atLimit = limit > 0 && usage >= limit;
  const supportsSignature = provider === 'stripe' || provider === 'github';
  const destination = destinationUrl.trim();
  const destinationChecked = Boolean(
    preflight?.reachable && preflight.url === destination && destination.length > 0,
  );

  const refreshIntegrations = useCallback(async () => {
    try {
      const result = await apiRequest<{ integrations: IntegrationSummary[] }>('/v1/integrations');
      setIntegrationRows(result.integrations);
      setIntegrationError('');
    } catch (requestError) {
      setIntegrationError(readableError(requestError));
    } finally {
      setIntegrationLoading(false);
    }
  }, []);

  const integrationByEndpoint = useMemo(
    () => new Map(integrationRows.map((integration) => [integration.endpointId, integration])),
    [integrationRows],
  );
  const attentionRouteCount = useMemo(
    () =>
      liveRoutes.filter((endpoint) => {
        const tone = integrationTone(integrationByEndpoint.get(endpoint.id), endpoint);
        return tone === 'down' || tone === 'degraded';
      }).length,
    [integrationByEndpoint, liveRoutes],
  );
  const pausedRouteCount = liveRoutes.filter((endpoint) => !endpoint.active).length;
  const visibleLiveRoutes = useMemo(
    () =>
      liveRoutes.filter((endpoint) => {
        const tone = integrationTone(integrationByEndpoint.get(endpoint.id), endpoint);
        if (routeFilter === 'attention') return tone === 'down' || tone === 'degraded';
        if (routeFilter === 'paused') return tone === 'paused';
        return true;
      }),
    [integrationByEndpoint, liveRoutes, routeFilter],
  );

  useEffect(() => {
    setPreflight(null);
    setPreflightError('');
  }, [destinationUrl, provider, signatureSecret]);

  useEffect(() => {
    setIntegrationLoading(true);
    void refreshIntegrations();
    const timer = window.setInterval(() => void refreshIntegrations(), 15_000);
    return () => window.clearInterval(timer);
  }, [refreshIntegrations]);

  async function runPreflight() {
    if (!destination) return;
    setPreflighting(true);
    setPreflightError('');
    setPreflight(null);
    try {
      const result = await apiRequest<Omit<PreflightResult, 'url'>>('/v1/preflight/destination', {
        method: 'POST',
        body: JSON.stringify({
          url: destination,
          provider,
          signatureConfigured: supportsSignature && signatureSecret.trim().length >= 8,
          contractConfigured: true,
        }),
      });
      setPreflight({ ...result, url: destination });
    } catch (requestError) {
      setPreflightError(readableError(requestError));
    } finally {
      setPreflighting(false);
    }
  }

  async function sendSyntheticEvent(endpoint: Endpoint) {
    setTestingRouteId(endpoint.id);
    setTestResult(undefined);
    try {
      const result = await apiRequest<TestEventResult>(`/v1/endpoints/${endpoint.id}/test-event`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      setTestResult({ routeId: endpoint.id, result });
      void refreshIntegrations();
    } catch (requestError) {
      setTestResult({ routeId: endpoint.id, error: readableError(requestError) });
    } finally {
      setTestingRouteId(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const scenario = scenarios[0];
    if (!scenario) return;
    if (!destinationChecked) {
      setError('Check that the destination is reachable before creating the live route.');
      return;
    }
    if (deliveryStrategy !== 'single' && mode !== 'protect') {
      setError('Fan-out and failover require Protect mode.');
      return;
    }
    const extraDestinations = additionalDestinations
      .map((destination, index) => ({
        name: destination.name.trim() || `Destination ${index + 2}`,
        url: destination.url.trim(),
      }))
      .filter((destination) => destination.url.length > 0);
    if (deliveryStrategy === 'failover' && extraDestinations.length === 0) {
      setError('Failover needs at least one fallback destination.');
      return;
    }
    setSubmitting(true);
    setError('');
    setCreated(null);
    try {
      const endpoint = await createEndpoint(name.trim(), scenario.id, {
        provider,
        mode,
        environment,
        destinationUrl: destinationUrl.trim(),
        ...(deliveryStrategy !== 'single'
          ? {
              deliveryPolicy: {
                strategy: deliveryStrategy,
                idempotencyScope,
                destinations: [
                  { name: 'Primary destination', url: destinationUrl.trim() },
                  ...extraDestinations,
                ],
              },
            }
          : {}),
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
      setDeliveryStrategy('single');
      setIdempotencyScope('destination');
      setAdditionalDestinations([]);
      setSignatureSecret('');
      setConfirmProduction(false);
      setPreflight(null);
      void refreshIntegrations();
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
    navigate(`/app/control-center/${endpoint.id}`);
  }

  return (
    <section
      className="ht-page ht-live-webhooks"
      data-product-area="product"
      data-tour-section="live-webhooks"
    >
      <PageHeader
        className="ht-live-head"
        eyebrow="PRODUCT / WEBHOOK HUB"
        title="Webhook Hub"
        description="Put HookTrials between every provider and your backend. Inspect the complete request, validate it and forward it with an auditable delivery trail."
        actions={
          <div className="ht-live-summary" aria-label="Live webhook summary">
            <div className="ht-live-stat">
              <strong>{liveRoutes.length}</strong>
              <span>live routes</span>
            </div>
            <div className="ht-live-stat">
              <strong>{liveRoutes.filter((route) => route.mode === 'protect').length}</strong>
              <span>protected</span>
            </div>
            {syntheticRoutes.length > 0 ? (
              <div className="ht-live-stat">
                <strong>{syntheticRoutes.length}</strong>
                <span>synthetic</span>
              </div>
            ) : null}
          </div>
        }
      />

      <WorkspaceJourney />

      <section className="ht-live-flow" aria-label="Webhook traffic flow">
        <article>
          <RadioTower aria-hidden="true" />
          <span>1</span>
          <div>
            <b>Provider sends</b>
            <small>Stripe, GitHub, Shopify, Slack, GitLab, Linear, HubSpot or any service</small>
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
        <form
          id="live-route-builder"
          className="ht-live-connect"
          onSubmit={(event) => void submit(event)}
        >
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
            {PROVIDERS.map(({ id, name, detail, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={provider === id ? 'active' : ''}
                onClick={() => setProvider(id)}
                aria-pressed={provider === id}
              >
                <Icon aria-hidden="true" />
                <b>{name}</b>
                <small>{detail}</small>
              </button>
            ))}
          </fieldset>

          <section className="ht-provider-contract" aria-live="polite">
            <div className="ht-provider-contract-heading">
              <ShieldCheck aria-hidden="true" />
              <div>
                <p className="ht-kicker">Inbound contract</p>
                <b>{PROVIDERS.find((item) => item.id === provider)?.name} verification</b>
              </div>
              <span>{supportsSignature ? 'Signature ready' : 'Header contract'}</span>
            </div>
            <p>
              HookTrials records the provider contract before forwarding traffic. Empty values mean
              that the header must be present; secrets are only accepted through write-only fields.
            </p>
            <div className="ht-provider-contract-tags">
              {Object.keys(providerContract(provider).requiredHeaders).map((header) => (
                <code key={header}>{header}</code>
              ))}
              {Object.keys(providerContract(provider).requiredHeaders).length === 0 ? (
                <code>content-type</code>
              ) : null}
            </div>
          </section>

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

          <section className="ht-destination-preflight" aria-live="polite">
            <div>
              <b>Destination preflight</b>
              <span>
                HookTrials checks public routing, DNS, TLS and HTTP reachability without sending a
                webhook payload.
              </span>
            </div>
            <button
              className="button secondary"
              type="button"
              disabled={!destination || preflighting}
              onClick={() => void runPreflight()}
            >
              {preflighting ? 'Checking destination…' : 'Check destination'}
            </button>
            {preflightError ? (
              <p className="ht-form-error" role="alert">
                {preflightError}
              </p>
            ) : null}
            {preflight ? (
              <div className="ht-preflight-results">
                <strong className={preflight.reachable ? 'passed' : 'failed'}>
                  {preflight.reachable
                    ? `Reachable${preflight.statusCode ? ` · HTTP ${preflight.statusCode}` : ''}${preflight.latencyMs !== null ? ` · ${preflight.latencyMs} ms` : ''}`
                    : 'Destination needs attention'}
                </strong>
                <ul>
                  {preflight.checks.map((check) => (
                    <li key={check.id} className={check.status}>
                      <i aria-hidden="true" />
                      <span>{check.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

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

          <section className="ht-delivery-policy" aria-labelledby="delivery-policy-title">
            <div className="ht-delivery-policy-heading">
              <div>
                <p className="ht-kicker">Protect routing</p>
                <h3 id="delivery-policy-title">Choose what happens when delivery branches</h3>
              </div>
              <span className="ht-policy-badge">Encrypted policy</span>
            </div>
            <div className="ht-monitor-form-grid">
              <label className="ht-field">
                Routing policy
                <select
                  value={deliveryStrategy}
                  onChange={(event) => {
                    const next = event.target.value as typeof deliveryStrategy;
                    setDeliveryStrategy(next);
                    if (next !== 'single' && mode !== 'protect') setMode('protect');
                    if (next === 'single') setAdditionalDestinations([]);
                  }}
                >
                  <option value="single">Single destination</option>
                  <option value="fanout">Fan-out · deliver to every target</option>
                  <option value="failover">Failover · move to the next target</option>
                </select>
                <small>
                  Fan-out runs targets independently. Failover advances only after the retry budget
                  is exhausted.
                </small>
              </label>
              <label className="ht-field">
                Idempotency scope
                <select
                  value={idempotencyScope}
                  onChange={(event) =>
                    setIdempotencyScope(event.target.value as typeof idempotencyScope)
                  }
                  disabled={deliveryStrategy === 'single'}
                >
                  <option value="destination">One key per destination</option>
                  <option value="event">One key per event</option>
                </select>
                <small>HookTrials sends a stable `x-hooktrials-idempotency-key` on retries.</small>
              </label>
            </div>
            {deliveryStrategy !== 'single' ? (
              <div className="ht-policy-destinations">
                <div className="ht-policy-destination-head">
                  <b>{deliveryStrategy === 'fanout' ? 'Fan-out targets' : 'Failover chain'}</b>
                  <span>Up to three HTTPS destinations. URLs are write-only after save.</span>
                </div>
                {additionalDestinations.map((destination, index) => (
                  <div className="ht-policy-destination-row" key={`${index}-${destination.name}`}>
                    <label className="ht-field">
                      Target name
                      <input
                        value={destination.name}
                        onChange={(event) =>
                          setAdditionalDestinations((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, name: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder={
                          deliveryStrategy === 'failover'
                            ? `Fallback ${index + 1}`
                            : `Target ${index + 2}`
                        }
                        maxLength={80}
                      />
                    </label>
                    <label className="ht-field ht-field-wide">
                      HTTPS destination
                      <input
                        type="url"
                        value={destination.url}
                        onChange={(event) =>
                          setAdditionalDestinations((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, url: event.target.value } : item,
                            ),
                          )
                        }
                        placeholder="https://backup.example.com/webhooks"
                      />
                    </label>
                    <button
                      className="button quiet"
                      type="button"
                      onClick={() =>
                        setAdditionalDestinations((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label={`Remove destination ${index + 2}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {additionalDestinations.length < 2 ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() =>
                      setAdditionalDestinations((items) => [
                        ...items,
                        {
                          name:
                            deliveryStrategy === 'failover'
                              ? `Fallback ${items.length + 1}`
                              : `Target ${items.length + 2}`,
                          url: '',
                        },
                      ])
                    }
                  >
                    Add destination
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

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

          {error ? (
            <p className="ht-form-error" role="alert">
              {error}
            </p>
          ) : null}
          {atLimit ? (
            <p className="ht-form-note">Hosted limit reached — remove an endpoint first.</p>
          ) : null}
          <button
            className="button primary"
            type="submit"
            disabled={
              submitting || loading || atLimit || scenarios.length === 0 || !destinationChecked
            }
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
              <div className="ht-live-curl">
                <div>
                  <b>Quick smoke test</b>
                  <CopyButton
                    value={`curl -X POST '${created.ingestUrl}' -H 'content-type: application/json' -d '{"event":"hooktrials.test","source":"manual"}'`}
                    label="Copy curl"
                  />
                </div>
                <code>
                  curl -X POST … -H &quot;content-type: application/json&quot; -d &apos;
                  {`{"event":"hooktrials.test"}`}&apos;
                </code>
              </div>
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
                    <span className="ht-form-error" role="alert">
                      {activationError}
                    </span>
                  ) : null}
                  <button className="button secondary" type="submit" disabled={activatingSignature}>
                    {activatingSignature ? 'Enabling…' : 'Enable signature verification'}
                  </button>
                </form>
              ) : null}
              <div className="ht-synthetic-test">
                <b>Verify the complete route now</b>
                <p>
                  This sends one clearly marked synthetic event through HookTrials and forwards it
                  to your configured destination.
                </p>
                <button
                  className="button primary"
                  type="button"
                  disabled={testingRouteId === created.id}
                  onClick={() => void sendSyntheticEvent(created)}
                >
                  {testingRouteId === created.id ? 'Sending synthetic event…' : 'Send test event'}
                </button>
                {testResult?.routeId === created.id ? (
                  <p
                    className={testResult.error ? 'ht-form-error' : 'ht-form-success'}
                    role={testResult.error ? 'alert' : 'status'}
                  >
                    {testResult.error ??
                      `Event recorded · HTTP ${testResult.result?.statusCode ?? '—'} · ${testResult.result?.latencyMs ?? '—'} ms`}
                  </p>
                ) : null}
              </div>
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
            <h2>Live connections</h2>
          </div>
          <div className="ht-live-routes-tools">
            <p>One control plane for every provider and backend.</p>
            <div className="ht-route-filters" role="tablist" aria-label="Filter live connections">
              {(
                [
                  ['all', `All ${liveRoutes.length}`],
                  ['attention', `Attention ${attentionRouteCount}`],
                  ['paused', `Paused ${pausedRouteCount}`],
                ] as const
              ).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={routeFilter === filter}
                  className={routeFilter === filter ? 'active' : ''}
                  onClick={() => setRouteFilter(filter)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>
        {integrationError ? (
          <p className="ht-live-inline-error" role="status">
            Live evidence could not refresh: {integrationError}
          </p>
        ) : null}
        {loading || (integrationLoading && integrationRows.length === 0) ? (
          <div className="ht-skeleton tall" aria-label="Loading live routes" />
        ) : liveRoutes.length === 0 ? (
          <ProductState
            compact
            title="No live routes yet."
            description="Connect a provider to a real backend when you are ready. Trial endpoints remain separate and safe."
            action={
              <button
                className="button secondary compact"
                type="button"
                onClick={() =>
                  document
                    .getElementById('live-route-builder')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                Configure first route
              </button>
            }
          />
        ) : visibleLiveRoutes.length === 0 ? (
          <ProductState
            compact
            title="No connections match this filter."
            description="Try another view or change the route state from Control Center."
            action={
              <button
                className="button secondary compact"
                type="button"
                onClick={() => setRouteFilter('all')}
              >
                Show all connections
              </button>
            }
          />
        ) : (
          <div className="ht-live-route-list">
            {visibleLiveRoutes.map((endpoint) => {
              const integration = integrationByEndpoint.get(endpoint.id);
              const tone = integrationTone(integration, endpoint);
              const latest = integration?.latestDelivery;
              return (
                <article
                  key={endpoint.id}
                  className={`ht-live-route-row ${tone}`}
                  aria-label={`${endpoint.name} · ${integrationToneLabel(tone)}`}
                >
                  <span className={`ht-listen ${endpoint.active ? 'on' : 'off'}`}>
                    <i /> {endpoint.active ? 'LIVE' : 'PAUSED'}
                  </span>
                  <div className="ht-live-route-title">
                    <strong>{endpoint.name}</strong>
                    <small>
                      {PROVIDERS.find((item) => item.id === endpoint.provider)?.name ?? 'Generic'} ·{' '}
                      {endpoint.environment}
                      {endpoint.demoOwned ? (
                        <span className="ht-demo-data-badge">DEMO DATA</span>
                      ) : null}
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
                  <div className={`ht-live-route-signal ${tone}`}>
                    <strong>{integrationToneLabel(tone)}</strong>
                    <small>
                      {latest
                        ? `Last ${latest.state.replace('_', ' ')} · ${timeAgo(latest.completedAt ?? latest.createdAt)}`
                        : 'No delivery evidence yet'}
                    </small>
                  </div>
                  <span className={`ht-mode-badge ${endpoint.mode}`}>{endpoint.mode}</span>
                  <div className="ht-live-route-actions">
                    <button
                      type="button"
                      className="button secondary compact"
                      disabled={testingRouteId === endpoint.id || !endpoint.active}
                      aria-busy={testingRouteId === endpoint.id}
                      onClick={() => void sendSyntheticEvent(endpoint)}
                    >
                      {testingRouteId === endpoint.id ? 'Sending…' : 'Run test'}
                    </button>
                    <button
                      type="button"
                      className="button secondary compact"
                      onClick={() => openRoute(endpoint)}
                    >
                      Inspect
                    </button>
                    {testResult?.routeId === endpoint.id ? (
                      <small className={testResult.error ? 'failed' : 'passed'}>
                        {testResult.error ??
                          `Recorded · HTTP ${testResult.result?.statusCode ?? '—'} · ${testResult.result?.latencyMs ?? '—'} ms`}
                      </small>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
