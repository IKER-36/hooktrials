import { describe, expect, it } from 'vitest';
import { builtInScenarios, resolveScenarioStep } from './index.js';

describe('resolveScenarioStep', () => {
  it('returns the configured attempt step', () => {
    expect(resolveScenarioStep(builtInScenarios.temporaryOutage!, 2).statusCode).toBe(500);
    expect(resolveScenarioStep(builtInScenarios.temporaryOutage!, 3).statusCode).toBe(200);
  });

  it('repeats the final step', () => {
    expect(resolveScenarioStep(builtInScenarios.rateLimited!, 10).statusCode).toBe(200);
  });

  it('rejects invalid attempt numbers', () => {
    expect(() => resolveScenarioStep(builtInScenarios.inspection!, 0)).toThrow(RangeError);
  });
});
