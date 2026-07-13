import { z } from 'zod';

export const scenarioStepSchema = z.object({
  statusCode: z.number().int().min(100).max(599),
  delayMs: z.number().int().min(0).max(30_000).default(0),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().max(16_384).optional(),
});

export const scenarioDefinitionSchema = z.object({
  name: z.string().min(2).max(80),
  steps: z.array(scenarioStepSchema).min(1).max(20),
  repeatLastStep: z.boolean().default(true),
});

export type ScenarioStep = z.infer<typeof scenarioStepSchema>;
export type ScenarioDefinition = z.infer<typeof scenarioDefinitionSchema>;

export function resolveScenarioStep(
  definition: ScenarioDefinition,
  attemptNumber: number,
): ScenarioStep {
  if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new RangeError('attemptNumber must be a positive integer');
  }

  const directStep = definition.steps[attemptNumber - 1];
  if (directStep) return directStep;

  if (!definition.repeatLastStep) {
    return { statusCode: 410, delayMs: 0, headers: {} };
  }

  const lastStep = definition.steps.at(-1);
  if (!lastStep) throw new Error('A scenario must contain at least one step');
  return lastStep;
}

export const builtInScenarios: Record<string, ScenarioDefinition> = {
  inspection: {
    name: 'Basic inspection',
    repeatLastStep: true,
    steps: [{ statusCode: 200, delayMs: 0, headers: {} }],
  },
  temporaryOutage: {
    name: 'Temporary outage',
    repeatLastStep: true,
    steps: [
      { statusCode: 500, delayMs: 0, headers: {} },
      { statusCode: 500, delayMs: 0, headers: {} },
      { statusCode: 200, delayMs: 0, headers: {} },
    ],
  },
  rateLimited: {
    name: 'Rate limited',
    repeatLastStep: true,
    steps: [
      { statusCode: 429, delayMs: 0, headers: { 'retry-after': '10' } },
      { statusCode: 200, delayMs: 0, headers: {} },
    ],
  },
  unstable: {
    name: 'Unstable endpoint',
    repeatLastStep: true,
    steps: [
      { statusCode: 500, delayMs: 0, headers: {} },
      { statusCode: 503, delayMs: 3_000, headers: {} },
      { statusCode: 429, delayMs: 0, headers: { 'retry-after': '8' } },
      { statusCode: 200, delayMs: 0, headers: {} },
    ],
  },
};
