export interface User {
  id: string;
  email: string;
  displayName: string;
  role?: string;
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
  name: string;
  tokenPrefix?: string;
  ingestUrl: string | null;
  active: boolean;
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
  sequence: number;
  statusCode: number;
  receivedAt: string;
}
export interface EventSummary {
  id: string;
  endpointId: string;
  correlationKey: string;
  bodyHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  attempts: AttemptSummary[];
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
}
export interface EventDetail {
  id: string;
  endpointId: string;
  correlationKey: string;
  bodyHash: string;
  attempts: AttemptDetail[];
  report: { status: string; score: number | null; result: unknown } | null;
}
