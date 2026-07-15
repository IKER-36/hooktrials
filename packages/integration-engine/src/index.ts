import { createHmac, timingSafeEqual } from 'node:crypto';

export type SignatureProvider = 'none' | 'github' | 'stripe';
export type SignatureStatus = 'not_configured' | 'valid' | 'invalid' | 'missing' | 'stale';

export interface WebhookContract {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  requiredHeaders: Record<string, string>;
  jsonPaths: Record<string, string | number | boolean | null>;
}

export interface ContractCheck {
  kind: 'method' | 'header' | 'json_path' | 'json';
  target: string;
  passed: boolean;
  message: string;
}

export interface WebhookContractResult {
  configured: boolean;
  passed: boolean;
  checks: ContractCheck[];
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = entry?.[1];
  return Array.isArray(value) ? value[0] : value;
}

function safeHexEqual(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual)) return false;
  const left = Buffer.from(actual.toLowerCase(), 'hex');
  const right = Buffer.from(expected.toLowerCase(), 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyWebhookSignature(input: {
  provider: SignatureProvider;
  secret: string | null;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): { provider: SignatureProvider; status: SignatureStatus; timestamp?: number } {
  if (input.provider === 'none') return { provider: 'none', status: 'not_configured' };
  if (!input.secret) return { provider: input.provider, status: 'invalid' };

  if (input.provider === 'github') {
    const header = headerValue(input.headers, 'x-hub-signature-256');
    if (!header) return { provider: 'github', status: 'missing' };
    const match = /^sha256=([a-f0-9]{64})$/i.exec(header);
    if (!match?.[1]) return { provider: 'github', status: 'invalid' };
    const expected = createHmac('sha256', input.secret).update(input.body).digest('hex');
    return { provider: 'github', status: safeHexEqual(match[1], expected) ? 'valid' : 'invalid' };
  }

  const header = headerValue(input.headers, 'stripe-signature');
  if (!header) return { provider: 'stripe', status: 'missing' };
  const parts = header.split(',').map((part) => part.trim().split('=', 2));
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1]);
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value ?? '');
  if (!Number.isInteger(timestamp) || signatures.length === 0) {
    return { provider: 'stripe', status: 'invalid' };
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1_000);
  if (Math.abs(now - timestamp) > (input.toleranceSeconds ?? 300)) {
    return { provider: 'stripe', status: 'stale', timestamp };
  }
  const expected = createHmac('sha256', input.secret)
    .update(`${timestamp}.`)
    .update(input.body)
    .digest('hex');
  return {
    provider: 'stripe',
    status: signatures.some((signature) => safeHexEqual(signature, expected)) ? 'valid' : 'invalid',
    timestamp,
  };
}

function jsonPathValue(value: unknown, path: string): { found: boolean; value?: unknown } {
  let current = value;
  for (const segment of path.slice(2).split('.')) {
    if (
      !current ||
      typeof current !== 'object' ||
      Array.isArray(current) ||
      !(segment in current)
    ) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

export function evaluateWebhookContract(input: {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  contract: WebhookContract | null;
}): WebhookContractResult {
  if (!input.contract) return { configured: false, passed: true, checks: [] };
  const checks: ContractCheck[] = [];
  if (input.contract.method) {
    const passed = input.method === input.contract.method;
    checks.push({
      kind: 'method',
      target: input.contract.method,
      passed,
      message: passed
        ? 'Method matched'
        : `Expected ${input.contract.method}, received ${input.method}`,
    });
  }
  for (const [name, expected] of Object.entries(input.contract.requiredHeaders)) {
    const actual = headerValue(input.headers, name);
    const passed = actual !== undefined && (expected === '' || actual === expected);
    checks.push({
      kind: 'header',
      target: name,
      passed,
      message: passed
        ? 'Header matched'
        : actual === undefined
          ? `Missing header ${name}`
          : `Header ${name} did not match`,
    });
  }
  const jsonEntries = Object.entries(input.contract.jsonPaths);
  if (jsonEntries.length > 0) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.body.toString('utf8')) as unknown;
    } catch {
      checks.push({ kind: 'json', target: '$', passed: false, message: 'Body is not valid JSON' });
      return { configured: true, passed: false, checks };
    }
    for (const [path, expected] of jsonEntries) {
      const actual = jsonPathValue(parsed, path);
      const passed = actual.found && Object.is(actual.value, expected);
      checks.push({
        kind: 'json_path',
        target: path,
        passed,
        message: passed
          ? 'JSON path matched'
          : !actual.found
            ? `Missing ${path}`
            : `${path} did not match expected value`,
      });
    }
  }
  return { configured: true, passed: checks.every((check) => check.passed), checks };
}

export interface ScoreDeduction {
  code: string;
  points: number;
  label: string;
  evidence: Record<string, unknown>;
}
export interface ReliabilityScore {
  score: number;
  deductions: ScoreDeduction[];
}

export interface ReadinessCheck {
  code: string;
  label: string;
  points: number;
  passed: boolean;
  action: string;
}

export interface IntegrationReadiness {
  score: number;
  level: 'starting' | 'developing' | 'production_ready';
  checks: ReadinessCheck[];
}

export interface ReliabilityReplay {
  outcome: 'received' | 'delivered' | 'recovered' | 'protected' | 'failed';
  headline: string;
  diagnosis: string;
  impact: string;
  durationMs: number;
  steps: Array<{
    code: string;
    label: string;
    detail: string;
    state: 'passed' | 'warning' | 'failed';
  }>;
  actions: string[];
}

function score(deductions: ScoreDeduction[]): ReliabilityScore {
  return {
    score: Math.max(0, 100 - deductions.reduce((total, item) => total + item.points, 0)),
    deductions,
  };
}

export function calculateIntegrationReadiness(input: {
  active: boolean;
  externalAccess: boolean;
  contractConfigured: boolean;
  signatureConfigured: boolean;
  destinationConfigured: boolean;
  protectMode: boolean;
  attemptsObserved: number;
  recoveryDemonstrated: boolean;
  evidenceGenerated: boolean;
  openIncident: boolean;
}): IntegrationReadiness {
  const checks: ReadinessCheck[] = [
    {
      code: 'active',
      label: 'Route is active',
      points: 5,
      passed: input.active,
      action: 'Resume the route before sending provider traffic.',
    },
    {
      code: 'external_access',
      label: 'Public HTTPS ingestion is reachable',
      points: 10,
      passed: input.externalAccess,
      action: 'Configure a public HTTPS domain or reverse proxy.',
    },
    {
      code: 'contract',
      label: 'Inbound contract is enforced',
      points: 15,
      passed: input.contractConfigured,
      action: 'Define the expected method, headers and payload fields.',
    },
    {
      code: 'signature',
      label: 'Provider signature is verified',
      points: 15,
      passed: input.signatureConfigured,
      action: 'Enable the GitHub or Stripe signature preset and add its secret.',
    },
    {
      code: 'destination',
      label: 'A destination is configured',
      points: 10,
      passed: input.destinationConfigured,
      action: 'Add the backend destination that should receive valid events.',
    },
    {
      code: 'protect',
      label: 'Durable protection is enabled',
      points: 15,
      passed: input.protectMode,
      action: 'Enable Protect mode to accept first and retry safely.',
    },
    {
      code: 'traffic',
      label: 'Real or synthetic traffic was observed',
      points: 10,
      passed: input.attemptsObserved > 0,
      action: 'Send a synthetic event or run a deterministic trial.',
    },
    {
      code: 'recovery',
      label: 'Recovery was demonstrated',
      points: 10,
      passed: input.recoveryDemonstrated,
      action: 'Run a failure-to-recovery scenario and inspect its timeline.',
    },
    {
      code: 'evidence',
      label: 'Evidence report was generated',
      points: 5,
      passed: input.evidenceGenerated,
      action: 'Complete a trial and wait for its background evidence report.',
    },
    {
      code: 'incident',
      label: 'No incident is currently open',
      points: 5,
      passed: !input.openIncident,
      action: 'Resolve the active incident and verify recovery.',
    },
  ];
  const readinessScore = checks.reduce(
    (total, check) => total + (check.passed ? check.points : 0),
    0,
  );
  return {
    score: readinessScore,
    level:
      readinessScore >= 85 ? 'production_ready' : readinessScore >= 55 ? 'developing' : 'starting',
    checks,
  };
}

export function buildReliabilityReplay(input: {
  mode: 'trial' | 'observe' | 'protect';
  attempts: Array<{
    sequence: number;
    receivedAt: Date | string;
    responseStatus: number;
    responseDelayMs: number;
    signatureProvider: SignatureProvider;
    signatureStatus: SignatureStatus;
    contractResult: { configured?: boolean; passed?: boolean };
  }>;
  deliveries: Array<{
    sequence: number;
    state: 'queued' | 'delivering' | 'succeeded' | 'failed' | 'retrying' | 'dead_letter';
    statusCode: number | null;
    errorCategory: string | null;
    startedAt: Date | string;
    completedAt: Date | string | null;
  }>;
}): ReliabilityReplay {
  const firstAttempt = input.attempts[0];
  const lastAttempt = input.attempts[input.attempts.length - 1];
  const lastDelivery = input.deliveries[input.deliveries.length - 1];
  const failedDeliveries = input.deliveries.filter((delivery) =>
    ['failed', 'retrying', 'dead_letter'].includes(delivery.state),
  );
  const recoveredDelivery = lastDelivery?.state === 'succeeded' && failedDeliveries.length > 0;
  const recoveredTrial =
    input.deliveries.length === 0 &&
    input.attempts.length > 1 &&
    Boolean(lastAttempt && lastAttempt.responseStatus >= 200 && lastAttempt.responseStatus < 300);
  const protectedDelivery = Boolean(
    lastDelivery && ['queued', 'delivering', 'retrying'].includes(lastDelivery.state),
  );
  const failed = Boolean(
    lastDelivery
      ? ['failed', 'dead_letter'].includes(lastDelivery.state)
      : lastAttempt && lastAttempt.responseStatus >= 400,
  );
  const outcome: ReliabilityReplay['outcome'] =
    recoveredDelivery || recoveredTrial
      ? 'recovered'
      : protectedDelivery
        ? 'protected'
        : failed
          ? 'failed'
          : lastDelivery?.state === 'succeeded' ||
              (lastAttempt && lastAttempt.responseStatus >= 200 && lastAttempt.responseStatus < 300)
            ? 'delivered'
            : 'received';
  const contractFailure = input.attempts.some(
    (attempt) => attempt.contractResult.configured && attempt.contractResult.passed === false,
  );
  const invalidSignature = input.attempts.some(
    (attempt) =>
      attempt.signatureProvider !== 'none' &&
      ['invalid', 'missing', 'stale'].includes(attempt.signatureStatus),
  );
  const start = firstAttempt ? new Date(firstAttempt.receivedAt).getTime() : Date.now();
  const endValue =
    lastDelivery?.completedAt ?? lastDelivery?.startedAt ?? lastAttempt?.receivedAt ?? start;
  const durationMs = Math.max(0, new Date(endValue).getTime() - start);
  const actions: string[] = [];
  if (invalidSignature)
    actions.push('Reject the event and verify the provider secret and timestamp tolerance.');
  if (contractFailure)
    actions.push('Compare the failed contract checks with the provider payload before replaying.');
  if (lastDelivery?.state === 'dead_letter')
    actions.push('Inspect the destination, then retry the protected dead-letter delivery.');
  if (failedDeliveries.some((delivery) => delivery.statusCode === 429))
    actions.push('Keep Retry-After handling enabled and review the destination rate limit.');
  if (failedDeliveries.some((delivery) => (delivery.statusCode ?? 0) >= 500))
    actions.push('Check destination availability and preserve bounded exponential retries.');
  if (outcome === 'recovered')
    actions.push('Save or share the redacted evidence as proof of recovery.');
  if (actions.length === 0)
    actions.push('Keep the contract, signing secret and recovery trial current.');

  const diagnosis = invalidSignature
    ? 'The provider request reached HookTrials, but signature verification did not pass.'
    : contractFailure
      ? 'The provider request reached HookTrials, but one or more inbound contract checks failed.'
      : recoveredDelivery
        ? `The destination failed ${failedDeliveries.length} time${failedDeliveries.length === 1 ? '' : 's'} before HookTrials completed the protected delivery.`
        : recoveredTrial
          ? `The provider retried ${input.attempts.length - 1} time${input.attempts.length === 2 ? '' : 's'} and the deterministic endpoint finally accepted the event.`
          : lastDelivery?.state === 'dead_letter'
            ? 'The protected delivery exhausted its retry budget and is waiting for an operator decision.'
            : protectedDelivery
              ? 'HookTrials accepted the event and is retaining it while bounded delivery continues.'
              : failed
                ? 'The latest attempt is still failing and recovery has not been demonstrated.'
                : 'The event completed inside the configured reliability boundary.';

  return {
    outcome,
    headline:
      outcome === 'recovered'
        ? 'Failure contained. Recovery proven.'
        : outcome === 'protected'
          ? 'Event protected while delivery continues.'
          : outcome === 'failed'
            ? 'Operator action required.'
            : outcome === 'delivered'
              ? 'Delivery completed.'
              : 'Event received.',
    diagnosis,
    impact:
      outcome === 'recovered'
        ? 'No data loss is visible in the recorded delivery chain.'
        : input.mode === 'protect' && outcome === 'protected'
          ? 'The provider was acknowledged and the payload remains in the durable queue.'
          : outcome === 'failed'
            ? 'Successful downstream processing is not yet proven.'
            : 'No active delivery failure is visible in this event.',
    durationMs,
    steps: [
      {
        code: 'receive',
        label: 'Provider → HookTrials',
        detail: `${input.attempts.length} inbound attempt${input.attempts.length === 1 ? '' : 's'} correlated`,
        state: 'passed',
      },
      {
        code: 'integrity',
        label: 'Integrity gate',
        detail: invalidSignature
          ? 'Signature verification failed'
          : contractFailure
            ? 'Inbound contract failed'
            : 'Configured integrity checks passed',
        state: invalidSignature || contractFailure ? 'failed' : 'passed',
      },
      {
        code: 'delivery',
        label: input.deliveries.length === 0 ? 'Deterministic trial' : 'Destination delivery',
        detail:
          input.deliveries.length > 0
            ? `${input.deliveries.length} delivery attempt${input.deliveries.length === 1 ? '' : 's'} recorded`
            : `${input.attempts.length} provider attempt${input.attempts.length === 1 ? '' : 's'} recorded`,
        state: outcome === 'failed' ? 'failed' : outcome === 'protected' ? 'warning' : 'passed',
      },
      {
        code: 'recovery',
        label: 'Final outcome',
        detail: diagnosis,
        state: outcome === 'failed' ? 'failed' : outcome === 'protected' ? 'warning' : 'passed',
      },
    ],
    actions: [...new Set(actions)],
  };
}

export function calculateMonitorScore(input: {
  availability: number | null;
  p95LatencyMs: number | null;
  timeoutMs: number;
  contractFailures: number;
  networkFailures: number;
  checks: number;
  openIncident: boolean;
}): ReliabilityScore {
  const deductions: ScoreDeduction[] = [];
  if (input.availability !== null && input.availability < 100)
    deductions.push({
      code: 'availability',
      points: Math.min(50, Math.round((100 - input.availability) / 2)),
      label: 'Availability below 100%',
      evidence: { availability: input.availability },
    });
  if (input.p95LatencyMs !== null && input.p95LatencyMs > input.timeoutMs * 0.8)
    deductions.push({
      code: 'latency',
      points: 10,
      label: 'p95 latency approaches timeout',
      evidence: { p95LatencyMs: input.p95LatencyMs, timeoutMs: input.timeoutMs },
    });
  if (input.contractFailures > 0)
    deductions.push({
      code: 'contract',
      points: Math.min(25, Math.ceil((input.contractFailures / Math.max(1, input.checks)) * 25)),
      label: 'Response contract failures',
      evidence: { failures: input.contractFailures, checks: input.checks },
    });
  if (input.networkFailures > 0)
    deductions.push({
      code: 'network',
      points: Math.min(15, Math.ceil((input.networkFailures / Math.max(1, input.checks)) * 15)),
      label: 'DNS or TLS failures',
      evidence: { failures: input.networkFailures },
    });
  if (input.openIncident)
    deductions.push({
      code: 'incident',
      points: 20,
      label: 'Open incident',
      evidence: { open: true },
    });
  return score(deductions);
}

export function calculateWebhookScore(input: {
  deliveries: number;
  failedDeliveries: number;
  retries: number;
  deadLetters: number;
  invalidSignatures: number;
  contractFailures: number;
  inboundAttempts: number;
  openIncident: boolean;
}): ReliabilityScore {
  const deductions: ScoreDeduction[] = [];
  if (input.failedDeliveries > 0)
    deductions.push({
      code: 'delivery',
      points: Math.min(
        35,
        Math.ceil((input.failedDeliveries / Math.max(1, input.deliveries)) * 35),
      ),
      label: 'Destination delivery failures',
      evidence: { failed: input.failedDeliveries, deliveries: input.deliveries },
    });
  if (input.retries > 0)
    deductions.push({
      code: 'retries',
      points: Math.min(15, input.retries * 3),
      label: 'Retries required',
      evidence: { retries: input.retries },
    });
  if (input.deadLetters > 0)
    deductions.push({
      code: 'dead_letter',
      points: Math.min(25, input.deadLetters * 15),
      label: 'Dead-letter deliveries',
      evidence: { deadLetters: input.deadLetters },
    });
  if (input.invalidSignatures > 0)
    deductions.push({
      code: 'signature',
      points: Math.min(15, input.invalidSignatures * 5),
      label: 'Invalid or missing signatures',
      evidence: { invalid: input.invalidSignatures, attempts: input.inboundAttempts },
    });
  if (input.contractFailures > 0)
    deductions.push({
      code: 'contract',
      points: Math.min(10, input.contractFailures * 2),
      label: 'Inbound contract failures',
      evidence: { failures: input.contractFailures },
    });
  if (input.openIncident)
    deductions.push({
      code: 'incident',
      points: 15,
      label: 'Open incident',
      evidence: { open: true },
    });
  return score(deductions);
}
