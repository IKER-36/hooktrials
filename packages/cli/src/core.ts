import YAML from 'yaml';

export interface TrialAttempt {
  expect: number;
  waitMs: number;
}

export interface TrialConfig {
  name: string;
  endpoint: string;
  headers: Record<string, string>;
  payload: unknown;
  eventId: string;
  timeoutMs: number;
  attempts: TrialAttempt[];
}

export interface TrialAttemptResult {
  sequence: number;
  expected: number;
  actual: number | null;
  durationMs: number;
  passed: boolean;
  error: string | null;
}

export interface TrialResult {
  name: string;
  passed: boolean;
  startedAt: string;
  completedAt: string;
  attempts: TrialAttemptResult[];
}

type Environment = Record<string, string | undefined>;

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, field: string, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${field} must be an integer between ${minimum} and ${maximum}`);
  }
  return Number(value);
}

export function parseTrialConfig(source: string, environment: Environment = process.env) {
  const raw = record(YAML.parse(source), 'config');
  const endpointValue = environment.HOOKTRIALS_ENDPOINT_URL || raw.endpoint;
  if (typeof endpointValue !== 'string') {
    throw new Error('endpoint or HOOKTRIALS_ENDPOINT_URL is required');
  }
  const endpoint = new URL(endpointValue);
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('endpoint must use http or https');
  }
  if (!Array.isArray(raw.attempts) || raw.attempts.length < 1 || raw.attempts.length > 20) {
    throw new Error('attempts must contain between 1 and 20 steps');
  }
  const attempts = raw.attempts.map((item, index) => {
    const attempt =
      typeof item === 'number' ? { expect: item } : record(item, `attempts[${index}]`);
    return {
      expect: integer(attempt.expect, `attempts[${index}].expect`, 100, 599),
      waitMs: integer(attempt.waitMs ?? 0, `attempts[${index}].waitMs`, 0, 30_000),
    };
  });
  const headerValues = raw.headers === undefined ? {} : record(raw.headers, 'headers');
  const headers = Object.fromEntries(
    Object.entries(headerValues).map(([key, value]) => {
      if (typeof value !== 'string') throw new Error(`headers.${key} must be a string`);
      return [key, value];
    }),
  );
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Webhook trial',
    endpoint: endpoint.toString(),
    headers,
    payload: raw.payload ?? { type: 'hooktrials.ci', synthetic: true },
    eventId:
      typeof raw.eventId === 'string' && raw.eventId.trim()
        ? raw.eventId.trim()
        : `ht-ci-${Date.now()}`,
    timeoutMs: integer(raw.timeoutMs ?? 15_000, 'timeoutMs', 1_000, 60_000),
    attempts,
  } satisfies TrialConfig;
}

export async function runTrial(
  config: TrialConfig,
  fetcher: typeof fetch = fetch,
): Promise<TrialResult> {
  const startedAt = new Date().toISOString();
  const body = typeof config.payload === 'string' ? config.payload : JSON.stringify(config.payload);
  const results: TrialAttemptResult[] = [];
  for (const [index, attempt] of config.attempts.entries()) {
    const started = performance.now();
    let actual: number | null = null;
    let error: string | null = null;
    try {
      const response = await fetcher(config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-event-id': config.eventId,
          ...config.headers,
        },
        body,
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      actual = response.status;
      await response.arrayBuffer();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'request failed';
    }
    results.push({
      sequence: index + 1,
      expected: attempt.expect,
      actual,
      durationMs: Math.round(performance.now() - started),
      passed: actual === attempt.expect,
      error,
    });
    if (attempt.waitMs > 0 && index < config.attempts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt.waitMs));
    }
  }
  return {
    name: config.name,
    passed: results.every((attempt) => attempt.passed),
    startedAt,
    completedAt: new Date().toISOString(),
    attempts: results,
  };
}

function xml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function junitReport(result: TrialResult) {
  const failures = result.attempts.filter((attempt) => !attempt.passed).length;
  const cases = result.attempts
    .map((attempt) => {
      const failure = attempt.passed
        ? ''
        : `<failure message="expected ${attempt.expected}, received ${attempt.actual ?? 'no response'}">${xml(attempt.error ?? 'unexpected status')}</failure>`;
      return `<testcase name="attempt ${attempt.sequence}" classname="${xml(result.name)}" time="${attempt.durationMs / 1_000}">${failure}</testcase>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><testsuite name="${xml(result.name)}" tests="${result.attempts.length}" failures="${failures}">${cases}</testsuite>\n`;
}
