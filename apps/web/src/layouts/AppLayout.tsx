import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import {
  Activity,
  BellRing,
  FlaskConical,
  Gauge,
  GitBranch,
  Code2,
  HelpCircle,
  BookOpen,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  RadioTower,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { OnboardingTour } from '../components/app/OnboardingTour';
import { useAuth } from '../context/AuthContext';
import { apiRequest, isAuthError, readableError } from '../lib/api';
import type { AccountLimits, Endpoint, Scenario } from '../lib/types';

const SELECTED_KEY = 'ht.selectedEndpoint';

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  end?: boolean;
}

interface NavigationGroup {
  id: 'product' | 'lab' | 'resources';
  label: string;
  contextLabel?: string;
  items: NavigationItem[];
}

export interface DashboardContext {
  endpoints: Endpoint[];
  scenarios: Scenario[];
  limits: AccountLimits | null;
  loading: boolean;
  selected: Endpoint | null;
  selectEndpoint(id: string): void;
  refresh(): Promise<void>;
  createEndpoint(
    name: string,
    scenarioId: string,
    configuration?: Record<string, unknown>,
  ): Promise<Endpoint>;
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
  const location = useLocation();
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('ht.sidebarCollapsed') === 'true',
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('ht.theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ht.sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

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

  const refresh = useCallback(async () => {
    const [endpointResponse, scenarioResponse] = await Promise.all([
      apiRequest<{ endpoints: Endpoint[]; limits?: AccountLimits }>('/v1/endpoints'),
      apiRequest<{ scenarios: Scenario[] }>('/v1/scenarios'),
    ]);
    setEndpoints(endpointResponse.endpoints);
    setLimits(endpointResponse.limits ?? null);
    setScenarios(scenarioResponse.scenarios);
    setSelectedId((current) => {
      const exists = endpointResponse.endpoints.some((endpoint) => endpoint.id === current);
      return exists ? current : (endpointResponse.endpoints[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    refresh()
      .catch(reportError)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, reportError, refresh]);

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
      refresh,
      async createEndpoint(name, scenarioId, configuration = {}) {
        const response = await apiRequest<{ endpoint: Endpoint }>('/v1/endpoints', {
          method: 'POST',
          body: JSON.stringify({ name, scenarioId, ...configuration }),
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
    [endpoints, scenarios, limits, loading, selectedId, selectEndpoint, refresh, reportError],
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

  const navigation: NavigationGroup[] = [
    {
      id: 'product',
      label: 'Product',
      contextLabel: 'Production workspace',
      items: [
        { to: '/app', label: 'Control Center', icon: Gauge, end: true },
        {
          to: '/app/live-webhooks',
          label: 'Webhook Hub',
          icon: RadioTower,
          count: endpoints.filter((endpoint) => endpoint.mode !== 'trial' && !endpoint.demoOwned)
            .length,
        },
        { to: '/app/monitor', label: 'Monitoring', icon: Radar },
        { to: '/app/operations', label: 'Operations', icon: BellRing },
      ],
    },
    {
      id: 'lab',
      label: 'Lab',
      contextLabel: 'Reliability Lab',
      items: [
        {
          to: '/app/endpoints',
          label: 'Trial endpoints',
          icon: GitBranch,
          count: endpoints.filter((endpoint) => endpoint.mode === 'trial').length,
        },
        {
          to: '/app/scenarios',
          label: 'Failure scenarios',
          icon: FlaskConical,
          count: scenarios.length,
        },
        { to: '/app/demo', label: 'Guided demo', icon: Activity },
      ],
    },
    {
      id: 'resources',
      label: 'Resources',
      items: [{ to: '/app/docs', label: 'Documentation', icon: BookOpen }],
    },
  ];
  const navigationItems = navigation.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      area: group.id,
      areaLabel: group.contextLabel ?? group.label,
    })),
  );
  const activeModule =
    navigationItems.find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
    ) ?? navigationItems[0]!;

  return (
    <div className={`ht-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="ht-mobilebar">
        <Brand />
        <div>
          <LanguageSwitcher compact />
          <button
            type="button"
            className="ht-mobile-tour"
            onClick={() => setTourOpen(true)}
            aria-label="Open product tour"
          >
            <HelpCircle aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ht-theme-toggle icon-only"
            onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="ht-logout"
            onClick={() => void logout()}
            aria-label="Log out"
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </header>
      <nav className="ht-mobilenav" aria-label="Dashboard sections">
        {navigationItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} aria-label={label}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <aside className="ht-sidebar">
        <div className="ht-sidebar-brand">
          <Brand />
          <button
            type="button"
            className="ht-sidebar-collapse"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </button>
        </div>
        <nav aria-label="Dashboard">
          {navigation.map((group) => (
            <div className="ht-nav-group" data-area={group.id} key={group.id}>
              <p>{group.label}</p>
              {group.items.map(({ to, label, icon: Icon, count, end }) => (
                <NavLink key={to} to={to} end={end} title={sidebarCollapsed ? label : undefined}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                  {count !== undefined ? <small>{count}</small> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="ht-sidebar-foot">
          <div className="ht-sidebar-profile">
            <span className="ht-account-avatar" aria-hidden="true">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="ht-account">
              <span>{user.displayName}</span>
              <small>{user.email}</small>
            </div>
            <span
              className="ht-runtime-dot"
              title={setup?.externalAccess ? 'External webhooks ready' : 'Local-only endpoints'}
              aria-label={
                setup?.externalAccess ? 'External webhooks ready' : 'Local-only endpoints'
              }
            />
          </div>
          <div className="ht-sidebar-tools">
            <LanguageSwitcher compact />
            <button
              type="button"
              className="ht-sidebar-tool"
              onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
              aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="ht-sidebar-tool"
              onClick={() => setTourOpen(true)}
              aria-label="Product tour"
              title="Product tour"
            >
              <HelpCircle aria-hidden="true" />
            </button>
            <a
              className="ht-sidebar-tool"
              href="https://github.com/IKER-36/hooktrials"
              target="_blank"
              rel="noreferrer"
              aria-label="Source code · AGPL-3.0"
              title="Source code · AGPL-3.0"
            >
              <Code2 aria-hidden="true" />
            </a>
            <button
              type="button"
              className="ht-sidebar-tool danger"
              onClick={() => void logout()}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut aria-hidden="true" />
            </button>
          </div>
          <a
            className="ht-cubepath-brand"
            href="https://cubepath.com/"
            target="_blank"
            rel="noreferrer"
            aria-label="Hosted on CubePath"
            title="Hosted on CubePath"
          >
            <span>Hosted on</span>
            <img className="light" src="/brand/cubepath-light.png" alt="CubePath" />
            <img className="dark" src="/brand/cubepath-dark.png" alt="" aria-hidden="true" />
          </a>
        </div>
      </aside>

      <main className="ht-main">
        {banner ? (
          <div className="ht-banner" role="alert">
            <span>{banner}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setBanner('')}>
              ×
            </button>
          </div>
        ) : null}
        <div
          className={`ht-workspace-context area-${activeModule.area}`}
          aria-label="Current module"
        >
          <span>
            <i aria-hidden="true" />
            {activeModule.areaLabel}
          </span>
          <b aria-hidden="true">/</b>
          <strong>{activeModule.label}</strong>
        </div>
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
