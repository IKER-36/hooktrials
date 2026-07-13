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

function score(deductions: ScoreDeduction[]): ReliabilityScore {
  return {
    score: Math.max(0, 100 - deductions.reduce((total, item) => total + item.points, 0)),
    deductions,
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
