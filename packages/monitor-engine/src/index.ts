export type MonitorOutcome = 'healthy' | 'degraded' | 'down';
export type MonitorState = 'new' | 'healthy' | 'degraded' | 'down' | 'paused';

export interface MonitorExpectation {
  minStatus: number;
  maxStatus: number;
  expectedText?: string | null;
  expectedJsonPath?: string | null;
}

export interface ContractResult {
  passed: boolean;
  statusPassed: boolean;
  textPassed: boolean | null;
  jsonPathPassed: boolean | null;
  failures: string[];
}

function jsonPathExists(body: string, path: string): boolean {
  let current: unknown;
  try {
    current = JSON.parse(body);
  } catch {
    return false;
  }
  for (const segment of path.slice(2).split('.')) {
    if (!current || typeof current !== 'object' || !(segment in current)) return false;
    current = (current as Record<string, unknown>)[segment];
  }
  return true;
}

export function evaluateContract(
  statusCode: number,
  body: Buffer,
  expectation: MonitorExpectation,
): ContractResult {
  const text = body.toString('utf8');
  const statusPassed = statusCode >= expectation.minStatus && statusCode <= expectation.maxStatus;
  const textPassed = expectation.expectedText ? text.includes(expectation.expectedText) : null;
  const jsonPathPassed = expectation.expectedJsonPath
    ? jsonPathExists(text, expectation.expectedJsonPath)
    : null;
  const failures: string[] = [];
  if (!statusPassed)
    failures.push(
      `Expected HTTP ${expectation.minStatus}-${expectation.maxStatus}, received ${statusCode}`,
    );
  if (textPassed === false) failures.push(`Expected response text was not found`);
  if (jsonPathPassed === false)
    failures.push(`Expected JSON path ${expectation.expectedJsonPath} was not found`);
  return {
    passed: failures.length === 0,
    statusPassed,
    textPassed,
    jsonPathPassed,
    failures,
  };
}

export function outcomeFromContract(contract: ContractResult): MonitorOutcome {
  if (contract.passed) return 'healthy';
  return contract.statusPassed ? 'degraded' : 'down';
}

export function deriveMonitorState(
  outcome: MonitorOutcome,
  previousFailures: number,
  failuresToOpen: number,
): { state: MonitorState; consecutiveFailures: number } {
  if (outcome === 'healthy') return { state: 'healthy', consecutiveFailures: 0 };
  const consecutiveFailures = previousFailures + 1;
  if (outcome === 'degraded' || consecutiveFailures < failuresToOpen) {
    return { state: 'degraded', consecutiveFailures };
  }
  return { state: 'down', consecutiveFailures };
}

export function percentile(values: number[], target: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(target * sorted.length) - 1));
  return sorted[index] ?? null;
}
