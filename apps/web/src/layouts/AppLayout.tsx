import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Outlet, useOutletContext } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { OnboardingTour } from '../components/app/OnboardingTour';
import { useAuth } from '../context/AuthContext';
import { apiRequest, isAuthError, readableError } from '../lib/api';
import type { AccountLimits, Endpoint, Scenario } from '../lib/types';

const SELECTED_KEY = 'ht.selectedEndpoint';

export interface DashboardContext {
  endpoints: Endpoint[];
  scenarios: Scenario[];
  limits: AccountLimits | null;
  loading: boolean;
  selected: Endpoint | null;
  selectEndpoint(id: string): void;
  createEndpoint(name: string, scenarioId: string): Promise<Endpoint>;
  toggleEndpoint(endpoint: Endpoint): Promise<void>;
  updateEndpoint(endpoint: Endpoint, input: Record<string, unknown>): Promise<Endpoint>;
  deleteEndpoint(endpoint: Endpoint): Promise<void>;
  saveScenario(input: Omit<Scenario, 'id' | 'builtIn'>, id?: string): Promise<Scenario>;
  deleteScenario(scenario: Scenario): Promise<void>;
  reportError(error: unknown): void;
}

export function useDashboard(): DashboardContext {
  return useOutletContext<DashboardContext>();
}

export function AppLayout() {
  const { user, loading: authLoading, setup, logout, clearSession, completeOnboarding } = useAuth();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [limits, setLimits] = useState<AccountLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem(SELECTED_KEY),
  );
  const [banner, setBanner] = useState('');
  const [tourOpen, setTourOpen] = useState(false);
  const [tourDecided, setTourDecided] = useState(false);

  useEffect(() => {
    if (authLoading || !user || tourDecided) return;
    setTourOpen(!user.onboardingCompletedAt);
    setTourDecided(true);
  }, [authLoading, tourDecided, user]);

  const reportError = useCallback(
    (error: unknown) => {
      if (isAuthError(error)) {
        clearSession();
        return;
      }
      setBanner(readableError(error));
    },
    [clearSession],
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      apiRequest<{ endpoints: Endpoint[]; limits?: AccountLimits }>('/v1/endpoints'),
      apiRequest<{ scenarios: Scenario[] }>('/v1/scenarios'),
    ])
      .then(([endpointResponse, scenarioResponse]) => {
        if (cancelled) return;
        setEndpoints(endpointResponse.endpoints);
        setLimits(endpointResponse.limits ?? null);
        setScenarios(scenarioResponse.scenarios);
        setSelectedId((current) => {
          const exists = endpointResponse.endpoints.some((endpoint) => endpoint.id === current);
          return exists ? current : (endpointResponse.endpoints[0]?.id ?? null);
        });
      })
      .catch(reportError)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, reportError]);

  const selectEndpoint = useCallback((id: string) => {
    setSelectedId(id);
    localStorage.setItem(SELECTED_KEY, id);
  }, []);

  const context = useMemo<DashboardContext>(
    () => ({
      endpoints,
      scenarios,
      limits,
      loading,
      selected: endpoints.find((endpoint) => endpoint.id === selectedId) ?? null,
      selectEndpoint,
      async createEndpoint(name, scenarioId) {
        const response = await apiRequest<{ endpoint: Endpoint }>('/v1/endpoints', {
          method: 'POST',
          body: JSON.stringify({ name, scenarioId }),
        });
        setEndpoints((items) => [response.endpoint, ...items]);
        selectEndpoint(response.endpoint.id);
        return response.endpoint;
      },
      async toggleEndpoint(endpoint) {
        const response = await apiRequest<{ endpoint: Endpoint }>(`/v1/endpoints/${endpoint.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ active: !endpoint.active }),
        });
        setEndpoints((items) =>
          items.map((item) => (item.id === endpoint.id ? { ...item, ...response.endpoint } : item)),
        );
      },
      async updateEndpoint(endpoint, input) {
        const response = await apiRequest<{ endpoint: Endpoint }>(`/v1/endpoints/${endpoint.id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        });
        const merged = { ...endpoint, ...response.endpoint };
        setEndpoints((items) => items.map((item) => (item.id === endpoint.id ? merged : item)));
        return merged;
      },
      async deleteEndpoint(endpoint) {
        await apiRequest(`/v1/endpoints/${endpoint.id}`, { method: 'DELETE' });
        setEndpoints((items) => {
          const remaining = items.filter((item) => item.id !== endpoint.id);
          setSelectedId((current) =>
            current === endpoint.id ? (remaining[0]?.id ?? null) : current,
          );
          return remaining;
        });
      },
      async saveScenario(input, id) {
        const response = await apiRequest<{ scenario: Scenario }>(
          id ? `/v1/scenarios/${id}` : '/v1/scenarios',
          { method: id ? 'PUT' : 'POST', body: JSON.stringify(input.definition) },
        );
        setScenarios((items) =>
          id
            ? items.map((item) => (item.id === id ? response.scenario : item))
            : [...items, response.scenario],
        );
        setEndpoints((items) =>
          items.map((endpoint) =>
            endpoint.scenarioId === response.scenario.id
              ? { ...endpoint, scenarioName: response.scenario.name }
              : endpoint,
          ),
        );
        return response.scenario;
      },
      async deleteScenario(scenario) {
        await apiRequest(`/v1/scenarios/${scenario.id}`, { method: 'DELETE' });
        setScenarios((items) => items.filter((item) => item.id !== scenario.id));
      },
      reportError,
    }),
    [endpoints, scenarios, limits, loading, selectedId, selectEndpoint, reportError],
  );

  if (authLoading) {
    return (
      <main className="ht-splash" aria-label="Loading HookTrials">
        <Brand />
        <p>Restoring session…</p>
      </main>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="ht-shell">
      <header className="ht-mobilebar">
        <Brand />
        <button type="button" className="ht-mobile-tour" onClick={() => setTourOpen(true)}>
          Tour
        </button>
        <button type="button" className="ht-logout" onClick={() => void logout()}>
          Log out
        </button>
      </header>
      <nav className="ht-mobilenav" aria-label="Dashboard sections">
        <NavLink to="/app" end>
          Overview
        </NavLink>
        <NavLink to="/app/endpoints">Endpoints</NavLink>
        <NavLink to="/app/scenarios">Scenarios</NavLink>
        <NavLink to="/app/monitor">Monitor</NavLink>
        <a href="https://github.com/IKER-36/hooktrials" target="_blank" rel="noreferrer">
          Source
        </a>
      </nav>

      <aside className="ht-sidebar">
        <div className="ht-sidebar-brand">
          <Brand />
          <span>{setup?.deploymentMode === 'cloud' ? 'CLOUD' : 'SELF-HOSTED'}</span>
        </div>
        <nav aria-label="Dashboard">
          <NavLink to="/app" end>
            <span>01</span> Overview
          </NavLink>
          <NavLink to="/app/endpoints">
            <span>02</span> Endpoints <small>{endpoints.length}</small>
          </NavLink>
          <NavLink to="/app/scenarios">
            <span>03</span> Scenario Studio <small>{scenarios.length}</small>
          </NavLink>
          <NavLink to="/app/monitor">
            <span>04</span> Monitor
          </NavLink>
        </nav>
        <div className="ht-sidebar-foot">
          <div className="ht-runtime-state">
            <span>
              <i /> API online
            </span>
            <span>
              <i /> {setup?.externalAccess ? 'external webhooks ready' : 'local-only endpoints'}
            </span>
          </div>
          <div className="ht-account">
            <span>{user.displayName}</span>
            <small>{user.email}</small>
          </div>
          <button type="button" className="ht-logout" onClick={() => void logout()}>
            Log out
          </button>
          <button type="button" className="ht-tour-restart" onClick={() => setTourOpen(true)}>
            Restart product tour
          </button>
          <a
            className="ht-cubepath-mini"
            href="https://cubepath.com/"
            target="_blank"
            rel="noreferrer"
          >
            Hosted on CubePath
          </a>
          <a
            className="ht-cubepath-mini"
            href="https://github.com/IKER-36/hooktrials"
            target="_blank"
            rel="noreferrer"
          >
            Source code · AGPL-3.0
          </a>
        </div>
      </aside>

      <main className="ht-main">
        <header className="ht-systembar">
          <code>hooktrials://workspace</code>
          <span>
            <i /> systems nominal
          </span>
        </header>
        {banner ? (
          <div className="ht-banner" role="alert">
            <span>{banner}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setBanner('')}>
              ×
            </button>
          </div>
        ) : null}
        <Outlet context={context} />
      </main>
      {tourOpen ? (
        <OnboardingTour
          onFinish={async () => {
            if (!user.onboardingCompletedAt) await completeOnboarding();
            setTourOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
