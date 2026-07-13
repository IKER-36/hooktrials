import { describe, expect, it } from 'vitest';
import { deriveMonitorState, evaluateContract, outcomeFromContract, percentile } from './index.js';

describe('monitor contracts', () => {
  it('passes status, text and JSON path', () => {
    const result = evaluateContract(200, Buffer.from('{"data":{"ready":true},"status":"ok"}'), {
      minStatus: 200,
      maxStatus: 299,
      expectedText: 'ok',
      expectedJsonPath: '$.data.ready',
    });
    expect(result.passed).toBe(true);
    expect(outcomeFromContract(result)).toBe('healthy');
  });

  it('degrades on content mismatch with valid HTTP', () => {
    const result = evaluateContract(200, Buffer.from('{"status":"warming"}'), {
      minStatus: 200,
      maxStatus: 299,
      expectedText: 'ready',
    });
    expect(outcomeFromContract(result)).toBe('degraded');
  });

  it('is down on unexpected HTTP status', () => {
    const result = evaluateContract(503, Buffer.from(''), { minStatus: 200, maxStatus: 299 });
    expect(outcomeFromContract(result)).toBe('down');
  });
});

describe('monitor state', () => {
  it('requires consecutive hard failures before down', () => {
    expect(deriveMonitorState('down', 0, 2)).toEqual({ state: 'degraded', consecutiveFailures: 1 });
    expect(deriveMonitorState('down', 1, 2)).toEqual({ state: 'down', consecutiveFailures: 2 });
  });

  it('recovers and clears failures', () => {
    expect(deriveMonitorState('healthy', 9, 2)).toEqual({
      state: 'healthy',
      consecutiveFailures: 0,
    });
  });

  it('calculates nearest-rank percentile', () => {
    expect(percentile([100, 200, 300, 400], 0.95)).toBe(400);
    expect(percentile([], 0.95)).toBeNull();
  });
});
