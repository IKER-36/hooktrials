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

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type CreateEndpointInput = z.infer<typeof createEndpointInputSchema>;
export type UpdateEndpointInput = z.infer<typeof updateEndpointInputSchema>;
