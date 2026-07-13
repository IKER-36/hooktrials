export function parseRetryAfter(
  value: string | string[] | undefined,
  maximumMs: number,
  nowMs = Date.now(),
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const seconds = Number(raw);
  const milliseconds = Number.isFinite(seconds) ? seconds * 1_000 : new Date(raw).getTime() - nowMs;
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return null;
  return Math.min(Math.round(milliseconds), maximumMs);
}

export function computeBackoff(
  attemptNumber: number,
  baseMs: number,
  maximumMs: number,
  random = Math.random,
): number {
  const bounded = Math.min(baseMs * 2 ** Math.max(0, attemptNumber - 1), maximumMs);
  const jitter = 0.8 + random() * 0.4;
  return Math.max(1_000, Math.round(bounded * jitter));
}

export function retriesExhausted(attemptNumber: number, maximumAttempts: number): boolean {
  return attemptNumber >= maximumAttempts;
}
