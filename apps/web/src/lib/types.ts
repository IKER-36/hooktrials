export interface User {
  id: string;
  email: string;
  displayName: string;
  role?: string;
  onboardingCompletedAt?: string | null;
}
export interface ScenarioStep {
  statusCode: number;
  delayMs: number;
  headers: Record<string, string>;
  body?: string;
}
export interface Scenario {
  id: string;
  name: string;
  builtIn: boolean;
  definition: { name: string; steps: ScenarioStep[]; repeatLastStep: boolean };
}
export interface Endpoint {
  id: string;
  resourceId?: string | null;
  name: string;
  tokenPrefix?: string;
  ingestUrl: string | null;
  active: boolean;
  mode: 'trial' | 'observe' | 'protect';
  environment: 'test' | 'staging' | 'production';
  destinationHost?: string | null;
  destinationConfigured?: boolean;
  destinationTimeoutMs?: number;
  retryMaxAttempts?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  contractConfigured?: boolean;
  signatureProvider?: 'none' | 'github' | 'stripe';
  signatureConfigured?: boolean;
  signatureToleranceSeconds?: number;
  destinationExpectedMinStatus?: number;
  destinationExpectedMaxStatus?: number;
  allowPrivateNetworks?: boolean;
  allowedPrivateCidrs?: string[];
  productionConfirmedAt?: string | null;
  scenarioId: string | null;
  scenarioName?: string | null;
  createdAt: string;
  expiresAt?: string | null;
}
export interface AccountLimits {
  endpoints: number;
  dailyEvents: number;
}
export interface SetupState {
  deploymentMode: 'cloud' | 'selfhost';
  registrationOpen: boolean;
  setupRequired: boolean;
  publicOrigin: string;
  externalAccess: boolean;
}
export interface AttemptSummary {
  id: string;
  sequence: number;
  statusCode: number;
  receivedAt: string;
  signatureProvider?: 'none' | 'github' | 'stripe';
  signatureStatus?: 'not_configured' | 'valid' | 'invalid' | 'missing' | 'stale';
  contractResult?: WebhookContractResult;
}
export interface WebhookContractResult {
  configured?: boolean;
  passed?: boolean;
  checks?: Array<{ kind: string; target: string; passed: boolean; message: string }>;
}
export interface ReliabilityScore {
  score: number;
  deductions: Array<{
    code: string;
    points: number;
    label: string;
    evidence: Record<string, unknown>;
  }>;
}
export interface DestinationDelivery {
  id: string;
  eventId: string;
  inboundAttemptId: string;
  resourceId: string;
  sequence: number;
  kind: 'forward' | 'retry' | 'replay';
  state: 'queued' | 'delivering' | 'succeeded' | 'failed' | 'retrying' | 'dead_letter';
  statusCode: number | null;
  latencyMs: number | null;
  responseBytes: number;
  errorCategory: string | null;
  errorMessage: string | null;
  requestedByUserId?: string | null;
  replayOfDeliveryId?: string | null;
  auditMetadata?: Record<string, unknown>;
  nextAttemptAt: string | null;
  startedAt: string;
  completedAt: string | null;
}
export interface EventSummary {
  id: string;
  endpointId: string;
  correlationKey: string;
  bodyHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  attempts: AttemptSummary[];
  deliveries: DestinationDelivery[];
}
export interface AttemptDetail {
  id: string;
  sequence: number;
  method: string;
  path: string;
  headers: Record<string, unknown>;
  body: string;
  bodyBase64: string;
  receivedAt: string;
  responseStatus: number;
  responseDelayMs: number;
  signatureProvider: 'none' | 'github' | 'stripe';
  signatureStatus: 'not_configured' | 'valid' | 'invalid' | 'missing' | 'stale';
  contractResult: WebhookContractResult;
}
export interface EventDetail {
  id: string;
  endpointId: string;
  correlationKey: string;
  bodyHash: string;
  attempts: AttemptDetail[];
  deliveries: DestinationDelivery[];
  report: { status: string; score: number | null; result: unknown } | null;
}

export type MonitorState = 'new' | 'healthy' | 'degraded' | 'down' | 'paused';
export type MonitorOutcome = 'healthy' | 'degraded' | 'down';

export interface Incident {
  id: string;
  resourceId: string;
  status: 'open' | 'recovered';
  cause: string;
  summary: string;
  evidence: unknown;
  openedAt: string;
  recoveredAt: string | null;
  resourceName?: string;
  resourceType?: string;
}

export interface MonitorMetrics {
  checks24h: number;
  availability24h: number | null;
  averageLatencyMs: number | null;
  p95LatencyMs: number | null;
  latest: {
    outcome: MonitorOutcome;
    latencyMs: number | null;
    statusCode: number | null;
    errorCategory: string | null;
    startedAt: string;
  } | null;
}

export interface MonitorSummary {
  id: string;
  resourceId: string;
  name: string;
  resourceType: 'external_api' | 'internal_api' | 'http_route' | 'webhook_destination';
  environment: 'test' | 'staging' | 'production';
  active: boolean;
  displayUrl: string;
  displayHost: string;
  method: 'GET' | 'HEAD' | 'POST';
  intervalSeconds: 60 | 300 | 900;
  timeoutMs: number;
  expectedMinStatus: number;
  expectedMaxStatus: number;
  expectedText: string | null;
  expectedJsonPath: string | null;
  consecutiveFailuresToOpen: number;
  allowPrivateNetworks: boolean;
  allowedPrivateCidrs: string[];
  hasAuthenticationHeaders: boolean;
  state: MonitorState;
  lastCheckAt: string | null;
  nextCheckAt: string;
  metrics: MonitorMetrics;
  incident: Incident | null;
  score: ReliabilityScore;
}

export interface MonitorCheck {
  id: string;
  monitorId: string;
  startedAt: string;
  completedAt: string;
  statusCode: number | null;
  latencyMs: number | null;
  responseBytes: number;
  outcome: MonitorOutcome;
  errorCategory: string | null;
  contractResult: {
    passed?: boolean;
    failures?: string[];
  };
}

export interface IntegrationSummary {
  id: string;
  endpointId: string;
  name: string;
  resourceType: 'webhook_route';
  environment: 'test' | 'staging' | 'production';
  active: boolean;
  mode: 'trial' | 'observe' | 'protect';
  destinationHost: string | null;
  state: MonitorState;
  latestDelivery: DestinationDelivery | null;
  incident: Incident | null;
  score: ReliabilityScore;
}
