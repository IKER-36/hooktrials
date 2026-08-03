import { useMemo, useState, type ChangeEvent } from 'react';
import { FileCode2, FileUp, Globe2, Info, LoaderCircle, ShieldCheck, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { ProductState } from '../../components/ui/ProductState';
import { useI18n } from '../../i18n/I18nContext';
import { apiRequest, readableError } from '../../lib/api';
import {
  parseOpenApiDocument,
  type OpenApiImportResult,
  type OpenApiImportedOperation,
} from '../../lib/openapi-import';

const MAX_SOURCE_BYTES = 1_000_000;
const MAX_IMPORTS = 20;
type ImportEnvironment = 'test' | 'staging' | 'production';
type SourceMode = 'file' | 'paste' | 'url';

interface ImportOutcome {
  name: string;
  ok: boolean;
  detail: string;
}

function operationLabel(operation: OpenApiImportedOperation): string {
  return operation.operationId || operation.name;
}

export function OpenApiImportPage() {
  const { t } = useI18n();
  const [sourceMode, setSourceMode] = useState<SourceMode>('file');
  const [sourceText, setSourceText] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [parsed, setParsed] = useState<OpenApiImportResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includePost, setIncludePost] = useState(false);
  const [environment, setEnvironment] = useState<ImportEnvironment>('test');
  const [intervalSeconds, setIntervalSeconds] = useState('300');
  const [busy, setBusy] = useState<'load' | 'parse' | 'import' | ''>('');
  const [error, setError] = useState('');
  const [outcomes, setOutcomes] = useState<ImportOutcome[]>([]);

  const eligible = useMemo(
    () =>
      parsed?.operations.filter(
        (operation) =>
          !operation.skipReason && (includePost || !operation.requiresPostConfirmation),
      ) ?? [],
    [includePost, parsed],
  );
  const selectedOperations = useMemo(
    () => eligible.filter((operation) => selected.has(operation.id)),
    [eligible, selected],
  );
  const skippedCount = parsed?.operations.filter((operation) => operation.skipReason).length ?? 0;
  const postCount =
    parsed?.operations.filter(
      (operation) => operation.requiresPostConfirmation && !operation.skipReason,
    ).length ?? 0;

  function selectDefaultOperations(result: OpenApiImportResult, allowPost = false) {
    const defaults = result.operations
      .filter(
        (operation) => !operation.skipReason && (allowPost || !operation.requiresPostConfirmation),
      )
      .slice(0, MAX_IMPORTS)
      .map((operation) => operation.id);
    setSelected(new Set(defaults));
  }

  function parseSource(nextBaseUrl = baseUrl) {
    setError('');
    setOutcomes([]);
    if (!sourceText.trim()) {
      setError(t('Add an OpenAPI JSON or YAML document first.'));
      return;
    }
    if (sourceText.length > MAX_SOURCE_BYTES) {
      setError(t('The OpenAPI document is larger than 1 MB.'));
      return;
    }
    setBusy('parse');
    try {
      const result = parseOpenApiDocument(sourceText, nextBaseUrl.trim());
      setParsed(result);
      setBaseUrl(result.baseUrl || nextBaseUrl.trim());
      selectDefaultOperations(result, includePost);
    } catch (parseError) {
      setParsed(null);
      setSelected(new Set());
      setError(
        parseError instanceof Error ? parseError.message : t('The document could not be parsed.'),
      );
    } finally {
      setBusy('');
    }
  }

  async function loadUrl() {
    setError('');
    setOutcomes([]);
    let url: URL;
    try {
      url = new URL(sourceUrl.trim());
    } catch {
      setError(t('Enter a valid HTTP(S) OpenAPI URL.'));
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      setError(t('Only HTTP(S) OpenAPI URLs are supported.'));
      return;
    }
    setBusy('load');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { accept: 'application/json, application/yaml, text/yaml, text/plain' },
      });
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_SOURCE_BYTES)
        throw new Error(t('The OpenAPI document is larger than 1 MB.'));
      if (!response.ok) throw new Error(t(`The OpenAPI URL returned HTTP ${response.status}.`));
      const text = await response.text();
      if (text.length > MAX_SOURCE_BYTES)
        throw new Error(t('The OpenAPI document is larger than 1 MB.'));
      setSourceText(text);
      setSourceLabel(url.hostname);
      const result = parseOpenApiDocument(text, baseUrl.trim());
      setParsed(result);
      setBaseUrl(result.baseUrl || baseUrl.trim());
      selectDefaultOperations(result, includePost);
    } catch (requestError) {
      setError(
        requestError instanceof DOMException && requestError.name === 'AbortError'
          ? t('The OpenAPI URL took too long to respond.')
          : requestError instanceof Error
            ? requestError.message
            : t('The OpenAPI URL could not be loaded.'),
      );
      setParsed(null);
      setSelected(new Set());
    } finally {
      window.clearTimeout(timeout);
      setBusy('');
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) {
      setError(t('The OpenAPI document is larger than 1 MB.'));
      return;
    }
    setError('');
    setOutcomes([]);
    setBusy('load');
    try {
      const text = await file.text();
      setSourceText(text);
      setSourceLabel(file.name);
      const result = parseOpenApiDocument(text, baseUrl.trim());
      setParsed(result);
      setBaseUrl(result.baseUrl || baseUrl.trim());
      selectDefaultOperations(result, includePost);
    } catch (fileError) {
      setParsed(null);
      setSelected(new Set());
      setError(fileError instanceof Error ? fileError.message : t('The file could not be parsed.'));
    } finally {
      setBusy('');
    }
  }

  function toggleOperation(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        if (next.size >= MAX_IMPORTS) return current;
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function togglePost(next: boolean) {
    setIncludePost(next);
    if (!parsed) return;
    setSelected((current) => {
      const nextSelected = new Set(
        [...current].filter((id) => {
          const operation = parsed.operations.find((item) => item.id === id);
          return Boolean(
            operation && !operation.skipReason && (next || !operation.requiresPostConfirmation),
          );
        }),
      );
      if (next) {
        for (const operation of parsed.operations) {
          if (
            nextSelected.size >= MAX_IMPORTS ||
            operation.skipReason ||
            !operation.requiresPostConfirmation
          )
            continue;
          nextSelected.add(operation.id);
        }
      }
      return nextSelected;
    });
  }

  async function importMonitors() {
    if (!selectedOperations.length) {
      setError(t('Select at least one operation to import.'));
      return;
    }
    if (selectedOperations.length > MAX_IMPORTS) {
      setError(t('Import up to 20 monitors at a time.'));
      return;
    }
    if (environment === 'production') {
      setError(t('OpenAPI imports are limited to test or staging until each monitor is reviewed.'));
      return;
    }
    setError('');
    setOutcomes([]);
    setBusy('import');
    const results: ImportOutcome[] = [];
    for (const operation of selectedOperations) {
      if (!operation.url) {
        results.push({
          name: operationLabel(operation),
          ok: false,
          detail: t('Missing target URL.'),
        });
        continue;
      }
      try {
        await apiRequest<{ monitor: { id: string } }>('/v1/monitors', {
          method: 'POST',
          body: JSON.stringify({
            name: operation.name,
            resourceType: 'external_api',
            protocol: 'http',
            environment,
            url: operation.url,
            method: operation.method,
            intervalSeconds: Number(intervalSeconds),
            timeoutMs: 10_000,
            expectedMinStatus: operation.expectedMinStatus,
            expectedMaxStatus: operation.expectedMaxStatus,
            consecutiveFailuresToOpen: 2,
            allowPrivateNetworks: false,
            allowedPrivateCidrs: [],
          }),
        });
        results.push({ name: operationLabel(operation), ok: true, detail: t('Monitor created.') });
      } catch (requestError) {
        results.push({
          name: operationLabel(operation),
          ok: false,
          detail: readableError(requestError),
        });
      }
    }
    setOutcomes(results);
    setSelected(new Set());
    setBusy('');
  }

  const successfulImports = outcomes.filter((outcome) => outcome.ok).length;

  return (
    <section className="ht-page ht-openapi-import" data-product-area="build">
      <PageHeader
        eyebrow={t('BUILD / INTEGRATIONS')}
        title={t('Import an OpenAPI contract')}
        description={t(
          'Turn documented read operations into monitored integrations without copying secrets or building each check by hand.',
        )}
        actions={
          <>
            <Link className="button secondary compact" to="/app/docs">
              {t('Open documentation')}
            </Link>
            <Link className="button secondary compact" to="/app/monitor">
              {t('View monitoring')}
            </Link>
          </>
        }
      />

      <div className="ht-openapi-intro" role="note">
        <ShieldCheck aria-hidden="true" />
        <p>
          <strong>{t('Safe by default.')}</strong>{' '}
          {t(
            'HookTrials imports operation names, paths and expected success codes. Authentication schemes, headers, request bodies and secrets are never copied.',
          )}
        </p>
      </div>

      <div className="ht-openapi-source-grid">
        <section
          className="ht-openapi-panel ht-openapi-source"
          aria-labelledby="openapi-source-title"
        >
          <header>
            <div>
              <p className="ht-kicker">{t('01 / SOURCE')}</p>
              <h2 id="openapi-source-title">{t('Bring your contract')}</h2>
            </div>
            {sourceLabel ? <code>{sourceLabel}</code> : null}
          </header>
          <div className="ht-openapi-tabs" role="tablist" aria-label={t('OpenAPI source')}>
            {(['file', 'paste', 'url'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={sourceMode === mode}
                className={sourceMode === mode ? 'active' : ''}
                onClick={() => setSourceMode(mode)}
              >
                {mode === 'file'
                  ? t('Upload file')
                  : mode === 'paste'
                    ? t('Paste JSON/YAML')
                    : t('Fetch URL')}
              </button>
            ))}
          </div>
          {sourceMode === 'file' ? (
            <label className="ht-openapi-dropzone">
              <FileUp aria-hidden="true" />
              <strong>{t('Choose an OpenAPI file')}</strong>
              <span>{t('JSON or YAML · maximum 1 MB')}</span>
              <input
                type="file"
                accept=".json,.yaml,.yml,application/json,text/yaml"
                onChange={(event) => void onFile(event)}
              />
            </label>
          ) : null}
          {sourceMode === 'paste' ? (
            <label className="ht-field ht-openapi-textarea">
              {t('OpenAPI document')}
              <textarea
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder={'openapi: 3.1.0\ninfo:\n  title: Payments API\npaths:'}
                rows={10}
              />
              <button
                className="button primary compact"
                type="button"
                onClick={() => parseSource()}
                disabled={busy !== ''}
              >
                {busy === 'parse' ? (
                  <LoaderCircle className="ht-spin" aria-hidden="true" />
                ) : (
                  <FileCode2 aria-hidden="true" />
                )}
                {t('Read contract')}
              </button>
            </label>
          ) : null}
          {sourceMode === 'url' ? (
            <div className="ht-openapi-url-form">
              <label className="ht-field">
                {t('Public OpenAPI URL')}
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://api.example.com/openapi.json"
                />
              </label>
              <button
                className="button primary compact"
                type="button"
                onClick={() => void loadUrl()}
                disabled={busy !== ''}
              >
                {busy === 'load' ? (
                  <LoaderCircle className="ht-spin" aria-hidden="true" />
                ) : (
                  <Globe2 aria-hidden="true" />
                )}
                {t('Fetch and read')}
              </button>
              <small>
                {t('The browser fetches the document directly. The source must allow CORS.')}
              </small>
            </div>
          ) : null}
          {sourceText && sourceMode !== 'paste' ? (
            <div className="ht-openapi-source-ready">
              <FileCode2 aria-hidden="true" />
              <span>{t('Document loaded. Read it again after changing the base URL.')}</span>
              <button
                className="button secondary compact"
                type="button"
                onClick={() => parseSource()}
                disabled={busy !== ''}
              >
                {t('Read again')}
              </button>
            </div>
          ) : null}
          <label className="ht-field ht-openapi-base-url">
            {t('Concrete server URL')}
            <input
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.example.com"
            />
            <small>
              {t('Overrides the first OpenAPI server and replaces variables with a concrete host.')}
            </small>
          </label>
        </section>

        <aside className="ht-openapi-panel ht-openapi-howto">
          <p className="ht-kicker">{t('WHAT WILL HAPPEN')}</p>
          <ol>
            <li>
              <b>01</b>
              <span>{t('Read the contract locally in your browser.')}</span>
            </li>
            <li>
              <b>02</b>
              <span>{t('Choose safe operations and review their targets.')}</span>
            </li>
            <li>
              <b>03</b>
              <span>{t('Create monitors in test or staging.')}</span>
            </li>
          </ol>
          <div className="ht-openapi-note">
            <Info aria-hidden="true" />
            <span>
              {t(
                'Path parameters are skipped until you provide concrete values. POST operations require an explicit opt-in.',
              )}
            </span>
          </div>
        </aside>
      </div>

      {error ? (
        <p className="ht-form-error" role="alert">
          {error}
        </p>
      ) : null}

      {!parsed ? (
        <ProductState
          tone="neutral"
          title={t('No contract loaded yet.')}
          description={t('Import an OpenAPI 3.x document to preview monitorable operations.')}
          action={
            <Link className="button secondary" to="/app/docs">
              {t('Read the import guide')}
            </Link>
          }
        />
      ) : (
        <section className="ht-openapi-preview" aria-labelledby="openapi-preview-title">
          <header>
            <div>
              <p className="ht-kicker">{t('02 / REVIEW')}</p>
              <h2 id="openapi-preview-title">{parsed.title}</h2>
              <p>
                {t('Version')} {parsed.version} · {parsed.baseUrl || t('server URL required')}
              </p>
            </div>
            <div className="ht-openapi-counts">
              <span>
                <b>{eligible.length}</b>
                {t('monitorable')}
              </span>
              <span>
                <b>{skippedCount}</b>
                {t('skipped')}
              </span>
            </div>
          </header>
          {parsed.warnings.length ? (
            <div className="ht-openapi-warnings" role="status">
              {parsed.warnings.map((warning) => (
                <p key={warning}>
                  <Info aria-hidden="true" />
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
          <div className="ht-openapi-settings">
            <label className="ht-field">
              {t('Environment')}
              <select
                value={environment}
                onChange={(event) => setEnvironment(event.target.value as ImportEnvironment)}
              >
                <option value="test">{t('Test')}</option>
                <option value="staging">{t('Staging')}</option>
                <option value="production">{t('Production')}</option>
              </select>
            </label>
            <label className="ht-field">
              {t('Frequency')}
              <select
                value={intervalSeconds}
                onChange={(event) => setIntervalSeconds(event.target.value)}
              >
                <option value="60">{t('Every minute')}</option>
                <option value="300">{t('Every 5 minutes')}</option>
                <option value="900">{t('Every 15 minutes')}</option>
              </select>
            </label>
            <label className="ht-inline-check ht-openapi-post-toggle">
              <input
                type="checkbox"
                checked={includePost}
                onChange={(event) => togglePost(event.target.checked)}
              />
              <span>
                <strong>{t('Include POST operations')}</strong>
                <small>{t('Sends an empty request; review side effects first.')}</small>
              </span>
            </label>
          </div>
          <div className="ht-openapi-selection-bar">
            <span>
              {selectedOperations.length} / {MAX_IMPORTS} {t('selected')}
            </span>
            <div>
              <button
                className="button secondary compact"
                type="button"
                onClick={() =>
                  setSelected(
                    new Set(eligible.slice(0, MAX_IMPORTS).map((operation) => operation.id)),
                  )
                }
              >
                {t('Select all safe')}
              </button>
              <button
                className="button ghost compact"
                type="button"
                onClick={() => setSelected(new Set())}
              >
                {t('Clear')}
              </button>
            </div>
          </div>
          <div className="ht-openapi-operations">
            {parsed.operations.map((operation) => {
              const canSelect =
                !operation.skipReason && (!operation.requiresPostConfirmation || includePost);
              return (
                <label
                  className={`ht-openapi-operation ${canSelect ? '' : 'is-disabled'}`}
                  key={operation.id}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(operation.id)}
                    disabled={
                      !canSelect || (!selected.has(operation.id) && selected.size >= MAX_IMPORTS)
                    }
                    onChange={(event) => toggleOperation(operation.id, event.target.checked)}
                  />
                  <span className={`ht-openapi-method method-${operation.method.toLowerCase()}`}>
                    {operation.method}
                  </span>
                  <span className="ht-openapi-operation-copy">
                    <strong>{operationLabel(operation)}</strong>
                    <code>{operation.path}</code>
                    {operation.summary ? <small>{operation.summary}</small> : null}
                  </span>
                  <span className="ht-openapi-operation-meta">
                    {operation.skipReason ? (
                      <>
                        <XCircle aria-hidden="true" />
                        {operation.skipReason}
                      </>
                    ) : (
                      <>
                        {operation.expectedMinStatus}–{operation.expectedMaxStatus}
                      </>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          {postCount && !includePost ? (
            <p className="ht-form-note">
              {t(
                `${postCount} POST operation${postCount === 1 ? '' : 's'} hidden until you opt in.`,
              )}
            </p>
          ) : null}
          <footer className="ht-openapi-actions">
            <span>{t('No authentication or request body is imported.')}</span>
            <button
              className="button primary"
              type="button"
              onClick={() => void importMonitors()}
              disabled={busy !== '' || !selectedOperations.length}
            >
              {busy === 'import' ? (
                <LoaderCircle className="ht-spin" aria-hidden="true" />
              ) : (
                <FileUp aria-hidden="true" />
              )}
              {t('Create selected monitors')}
            </button>
          </footer>
        </section>
      )}

      {outcomes.length ? (
        <section className="ht-openapi-results" aria-live="polite">
          <header>
            <div>
              <p className="ht-kicker">{t('03 / RESULT')}</p>
              <h2>
                {successfulImports} / {outcomes.length} {t('monitors created')}
              </h2>
            </div>
            <Link className="button secondary compact" to="/app/monitor">
              {t('Open monitoring')}
            </Link>
          </header>
          <ul>
            {outcomes.map((outcome) => (
              <li
                className={outcome.ok ? 'ok' : 'failed'}
                key={`${outcome.name}:${outcome.detail}`}
              >
                <span>{outcome.ok ? '✓' : '!'}</span>
                <strong>{outcome.name}</strong>
                <small>{outcome.detail}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
