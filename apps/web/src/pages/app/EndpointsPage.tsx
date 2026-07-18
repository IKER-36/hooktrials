import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EndpointTemplates } from '../../components/app/EndpointTemplates';
import { ScenarioPicker } from '../../components/app/ScenarioPicker';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useDashboard } from '../../layouts/AppLayout';
import { readableError } from '../../lib/api';
import { shortDate } from '../../lib/format';
import type { Endpoint } from '../../lib/types';

export function EndpointsPage() {
  const {
    endpoints,
    scenarios,
    limits,
    loading,
    selected,
    selectEndpoint,
    createEndpoint,
    toggleEndpoint,
    deleteEndpoint,
    reportError,
  } = useDashboard();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<Endpoint | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioId && scenarios[0]) setScenarioId(scenarios[0].id);
  }, [scenarios, scenarioId]);

  const limit = limits?.endpoints ?? 0;
  const limited = limit > 0;
  const trialEndpoints = endpoints.filter((endpoint) => endpoint.mode === 'trial');
  const endpointUsage =
    limits?.endpointUsage ?? endpoints.filter((endpoint) => !endpoint.demoOwned).length;
  const atLimit = limited && endpointUsage >= limit;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scenarioId) return;
    setSubmitting(true);
    setFormError('');
    try {
      await createEndpoint(name.trim(), scenarioId);
      setName('');
      navigate('/app');
    } catch (error) {
      setFormError(readableError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(endpoint: Endpoint) {
    setTogglingId(endpoint.id);
    try {
      await toggleEndpoint(endpoint);
    } catch (error) {
      reportError(error);
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteEndpoint(deleting);
      setDeleting(null);
    } catch (error) {
      reportError(error);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section className="ht-page" data-tour-section="endpoints" data-product-area="lab">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Reliability Lab</p>
          <h1>Trial endpoints</h1>
          <p className="ht-muted-line">
            Exercise failure and retry behaviour with synthetic traffic, completely separate from
            your live webhook routes.
          </p>
        </div>
        <span
          className="ht-limit"
          aria-label={
            limited
              ? `${endpointUsage} of ${limit} regular endpoints used`
              : `${trialEndpoints.length} trial endpoints`
          }
        >
          {limited ? (
            <span className="ht-limit-meter" aria-hidden="true">
              {Array.from({ length: limit }, (_, index) => (
                <i key={index} className={index < endpointUsage ? 'used' : ''} />
              ))}
            </span>
          ) : null}
          {limited ? `${endpointUsage}/${limit} used` : `${trialEndpoints.length} · unlimited`}
        </span>
      </header>

      <EndpointTemplates
        scenarios={scenarios}
        activeId={templateId}
        disabled={loading || atLimit}
        onSelect={(selectedTemplate, endpointName, selectedScenario) => {
          setTemplateId(selectedTemplate);
          setName(endpointName);
          setScenarioId(selectedScenario);
          document.getElementById('endpoint-name')?.focus();
        }}
      />

      <div className="ht-endpoints-grid">
        <form className="ht-create-card" onSubmit={submit} aria-label="Create endpoint">
          <p className="ht-kicker">New trial</p>
          <h2>Create an endpoint</h2>
          <p className="ht-muted-line">
            Choose a deterministic response sequence, then point your webhook provider at the
            generated URL.
          </p>

          <label className="ht-field">
            Endpoint name
            <input
              id="endpoint-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setTemplateId(null);
              }}
              placeholder="stripe-staging"
              minLength={2}
              maxLength={80}
              required
              disabled={atLimit}
            />
          </label>

          {loading ? (
            <div className="ht-skeleton" aria-label="Loading scenarios" />
          ) : (
            <ScenarioPicker
              scenarios={scenarios}
              value={scenarioId}
              onChange={(id) => {
                setScenarioId(id);
                setTemplateId(null);
              }}
              disabled={atLimit}
            />
          )}

          {formError ? (
            <p className="ht-form-error" role="alert">
              {formError}
            </p>
          ) : null}

          {atLimit ? (
            <p className="ht-form-note" role="status">
              Hosted limit reached — delete an endpoint to create a new one.
            </p>
          ) : null}

          <button
            className="button primary"
            type="submit"
            disabled={submitting || atLimit || scenarios.length === 0}
          >
            {submitting ? 'Creating…' : 'Create endpoint'}
          </button>
          <small className="ht-muted-line">Use synthetic payloads whenever possible.</small>
        </form>

        <div className="ht-endpoint-list" aria-label="Your trial endpoints">
          {loading ? (
            <div className="ht-skeleton tall" />
          ) : trialEndpoints.length === 0 ? (
            <div className="ht-events-empty">
              <h3>No endpoints yet.</h3>
              <p>Create your first trial endpoint with the form on this page.</p>
            </div>
          ) : (
            trialEndpoints.map((endpoint) => (
              <article
                key={endpoint.id}
                className={`ht-endpoint-item ${endpoint.id === selected?.id ? 'selected' : ''}`}
              >
                <button
                  type="button"
                  className="ht-endpoint-select"
                  onClick={() => {
                    selectEndpoint(endpoint.id);
                    navigate('/app');
                  }}
                >
                  <span className={`ht-listen ${endpoint.active ? 'on' : 'off'}`}>
                    <i aria-hidden="true" />
                    {endpoint.active ? 'LISTENING' : 'PAUSED'}
                  </span>
                  <span className="ht-endpoint-name">
                    <strong>{endpoint.name}</strong>
                    <small>
                      {endpoint.scenarioName ?? 'Basic inspection'} · {endpoint.tokenPrefix}… ·
                      created {shortDate(endpoint.createdAt)}
                    </small>
                  </span>
                </button>
                <div className="ht-endpoint-actions">
                  <button
                    type="button"
                    onClick={() => void toggle(endpoint)}
                    disabled={togglingId === endpoint.id}
                  >
                    {togglingId === endpoint.id ? '…' : endpoint.active ? 'Pause' : 'Resume'}
                  </button>
                  <button type="button" className="danger" onClick={() => setDeleting(endpoint)}>
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.name ?? ''}”?`}
        body="This permanently removes the endpoint and every captured event and attempt. Providers pointing at its URL will start receiving 404."
        confirmLabel="Delete endpoint"
        busy={deleteBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
