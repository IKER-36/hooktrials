import { z } from 'zod';

export const healthResponseSchema = z.object({
  service: z.string(),
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export const registerInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(80),
});

export const loginInputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const createEndpointInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  scenarioId: z.string().uuid().optional(),
});

export const updateEndpointInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    scenarioId: z.string().uuid().nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const scenarioStepInputSchema = z.object({
  statusCode: z.number().int().min(100).max(599),
  delayMs: z.number().int().min(0).max(30_000).default(0),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().max(16_384).optional(),
});

export const scenarioInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  steps: z.array(scenarioStepInputSchema).min(1).max(20),
  repeatLastStep: z.boolean().default(true),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type CreateEndpointInput = z.infer<typeof createEndpointInputSchema>;
export type UpdateEndpointInput = z.infer<typeof updateEndpointInputSchema>;
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
