import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BellRing,
  BookOpen,
  FlaskConical,
  Gauge,
  GitBranch,
  Radar,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

interface Guide {
  id: string;
  title: string;
  summary: string;
  icon: typeof Gauge;
  route: string;
  purpose: string;
  steps: string[];
  result: string;
  troubleshooting: string[];
}

const guides: Guide[] = [
  {
    id: 'overview',
    title: 'Overview & Readiness',
    summary: 'Understand current risk and the next highest-impact action.',
    icon: Gauge,
    route: '/app',
    purpose:
      'Overview combines route state, active monitoring, incidents, recovery evidence and Production Readiness for the selected endpoint.',
    steps: [
      'Choose the endpoint from the selector at the top of the page.',
      'Read the Control Center for cross-product health and operational work.',
      'Use Production Readiness to find the first unproven reliability control.',
      'Open a retry timeline to inspect Reliability Replay and individual attempts.',
    ],
    result: 'You leave with an evidence-backed next action, not a generic score.',
    troubleshooting: [
      'A new endpoint has little evidence until it receives traffic.',
      'A local-only self-hosted URL cannot be reached by a cloud provider; configure HTTPS first.',
    ],
  },
  {
    id: 'endpoints',
    title: 'Endpoints & route modes',
    summary: 'Receive, observe or protect webhook traffic with one stable URL.',
    icon: GitBranch,
    route: '/app/endpoints',
    purpose:
      'An endpoint is the private ingestion URL used by a provider. Its route mode controls whether HookTrials simulates, forwards or durably delivers the request.',
    steps: [
      'Create an endpoint from a template or choose a scenario manually.',
      'Copy the ingestion URL and send only synthetic data while testing.',
      'Use Trial for deterministic responses and retry verification.',
      'Configure a destination before selecting Observe or Protect.',
      'Add a contract and GitHub or Stripe signature verification where appropriate.',
    ],
    result: 'The same endpoint can mature from a safe trial into an observable or protected route.',
    troubleshooting: [
      '401 means the configured provider signature did not verify.',
      '422 means the inbound method, headers or JSON contract did not match.',
      'Protect returns 202 because delivery continues asynchronously.',
    ],
  },
  {
    id: 'scenarios',
    title: 'Scenario Studio',
    summary: 'Create exact, repeatable failure sequences.',
    icon: FlaskConical,
    route: '/app/scenarios',
    purpose:
      'A scenario defines the response HookTrials returns for each correlated attempt: status, delay, headers and optional body.',
    steps: [
      'Copy a built-in scenario or create a new recipe.',
      'Add and reorder steps for the expected retry sequence.',
      'Use Retry-After on 429 or 503 responses when you want to test compliance.',
      'Save the scenario, then assign it to a Trial endpoint.',
    ],
    result: 'Every run is deterministic, making regressions and CI evidence reproducible.',
    troubleshooting: [
      'Reuse the same payload id to correlate attempts into one timeline.',
      'A built-in scenario is read-only; copy it before editing.',
    ],
  },
  {
    id: 'monitor',
    title: 'Monitor',
    summary: 'Measure availability, latency, contracts and incident recovery.',
    icon: Radar,
    route: '/app/monitor',
    purpose:
      'Monitors run active HTTP checks against an API, route or webhook destination and retain evidence for explainable health scores.',
    steps: [
      'Create a monitor with a public URL, or explicitly allow a trusted private network.',
      'Define the expected status and optional response contract.',
      'Run it immediately, then leave the schedule active.',
      'Inspect availability, p95 latency, recent checks and incident history.',
      'Create a revocable public status page when health should be shared.',
    ],
    result: 'Degradation and recovery become measured incidents with a retained history.',
    troubleshooting: [
      'DNS, private-network and redirect blocks are intentional SSRF protections.',
      'A contract can degrade a monitor even when the HTTP status is 200.',
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    summary: 'Triage incidents, dead letters and outgoing alerts.',
    icon: BellRing,
    route: '/app/operations',
    purpose:
      'Operations is the recovery queue for failures that need an operator decision or a proof that automation recovered correctly.',
    steps: [
      'Review open incidents and the recorded failure cause.',
      'Inspect unresolved dead letters before choosing Retry or Replay.',
      'Confirm the action; HookTrials records the requester and source delivery.',
      'Configure an alert webhook and use the audit log to verify delivery.',
    ],
    result: 'Recovery actions and notifications remain attributable and auditable.',
    troubleshooting: [
      'Retry continues the same recovery chain; Replay creates a labelled new delivery.',
      'A failed alert never changes the underlying incident state.',
    ],
  },
  {
    id: 'demo',
    title: 'Demo Lab',
    summary: 'Learn every module with isolated synthetic resources.',
    icon: Activity,
    route: '/app/demo',
    purpose:
      'Demo Lab exercises the complete control loop without modifying normal resources or consuming the regular endpoint quota.',
    steps: [
      'Run the full demo and keep the page open while eight stages complete.',
      'Open Overview, Monitor and Operations to inspect the generated evidence.',
      'Return to Demo Lab when you want to reset all demo-owned runs.',
    ],
    result:
      'You see a realistic populated product while all data remains synthetic and user-owned.',
    troubleshooting: [
      'An existing demo is recovered after reload; reset it before starting another run.',
      'Never use Demo Lab as a substitute for validating a real integration.',
    ],
  },
  {
    id: 'security',
    title: 'Security & data handling',
    summary: 'Know what is stored, exposed and deliberately blocked.',
    icon: ShieldCheck,
    route: '/app/docs',
    purpose:
      'HookTrials treats every inbound payload and outbound destination as untrusted. Secrets and bodies have stricter handling than operational metadata.',
    steps: [
      'Use synthetic payloads in Cloud and keep retention short.',
      'Store signing and destination secrets through write-only fields.',
      'Share only redacted evidence or a payload-free public status page.',
      'Review private-network allowances before enabling them.',
    ],
    result: 'Testing remains useful without turning the hosted sandbox into a secrets vault.',
    troubleshooting: [
      'Destination URLs and secret headers are encrypted and never returned to the browser.',
      'Revoking a public link invalidates its opaque token immediately.',
    ],
  },
];

export function DocsPage() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('overview');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return guides;
    return guides.filter((guide) =>
      [
        guide.title,
        guide.summary,
        guide.purpose,
        guide.result,
        ...guide.steps,
        ...guide.troubleshooting,
        t(guide.title),
        t(guide.summary),
        t(guide.purpose),
        t(guide.result),
        ...guide.steps.map(t),
        ...guide.troubleshooting.map(t),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [locale, query, t]);
  const selected =
    filtered.find((guide) => guide.id === selectedId) ??
    filtered[0] ??
    guides.find((guide) => guide.id === selectedId) ??
    guides[0]!;
  const Icon = selected.icon;

  return (
    <section className="ht-page ht-docs" data-tour-section="docs">
      <header className="ht-page-head">
        <div>
          <p className="ht-kicker">Product guide</p>
          <h1>Docs</h1>
          <p className="ht-muted-line">
            What every module does, when to use it and how to verify the result.
          </p>
        </div>
        <a
          className="button secondary"
          href="https://github.com/IKER-36/hooktrials/tree/main/docs"
          target="_blank"
          rel="noreferrer"
        >
          <BookOpen aria-hidden="true" /> Technical docs
        </a>
      </header>

      <div className="ht-docs-search">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="docs-search">
          Search product documentation
        </label>
        <input
          id="docs-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search routes, monitoring, recovery…"
        />
      </div>

      <div className="ht-docs-layout">
        <nav className="ht-docs-nav" aria-label="Product documentation">
          {filtered.length ? (
            filtered.map((guide) => {
              const GuideIcon = guide.icon;
              return (
                <button
                  key={guide.id}
                  type="button"
                  className={guide.id === selected.id ? 'active' : ''}
                  onClick={() => setSelectedId(guide.id)}
                >
                  <GuideIcon aria-hidden="true" />
                  <span>
                    <strong>{t(guide.title)}</strong>
                    <small>{t(guide.summary)}</small>
                  </span>
                </button>
              );
            })
          ) : (
            <p>No guide matches “{query}”.</p>
          )}
        </nav>

        <article className="ht-docs-article">
          <header>
            <span className="ht-docs-icon">
              <Icon aria-hidden="true" />
            </span>
            <div>
              <p className="ht-kicker">How it works</p>
              <h2>{t(selected.title)}</h2>
              <p>{t(selected.purpose)}</p>
            </div>
          </header>
          <section>
            <h3>Use it step by step</h3>
            <ol>
              {selected.steps.map((step) => (
                <li key={step}>{t(step)}</li>
              ))}
            </ol>
          </section>
          <aside className="ht-docs-result">
            <strong>Expected result</strong>
            <p>{t(selected.result)}</p>
          </aside>
          <section>
            <h3>If the result looks wrong</h3>
            <ul>
              {selected.troubleshooting.map((item) => (
                <li key={item}>{t(item)}</li>
              ))}
            </ul>
          </section>
          {selected.route !== '/app/docs' ? (
            <Link className="button primary" to={selected.route}>
              {t('Open')} {t(selected.title)}
            </Link>
          ) : null}
        </article>
      </div>
    </section>
  );
}
