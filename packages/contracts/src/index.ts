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

export const onboardingInputSchema = z.object({
  completed: z.literal(true),
});

const outboundHeadersSchema = z
  .record(z.string().min(1).max(80), z.string().max(2_048))
  .refine((headers) => Object.keys(headers).length <= 20, 'At most 20 headers are allowed');

const jsonPathSchema = z.string().regex(/^\$(?:\.[A-Za-z_][A-Za-z0-9_-]*){1,8}$/);
const contractValueSchema = z.union([z.string().max(512), z.number(), z.boolean(), z.null()]);
export const webhookContractSchema = z.object({
  method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  requiredHeaders: z.record(z.string().min(1).max(80), z.string().max(512)).default({}),
  jsonPaths: z.record(jsonPathSchema, contractValueSchema).default({}),
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
    mode: z.enum(['trial', 'observe', 'protect']).optional(),
    environment: z.enum(['test', 'staging', 'production']).optional(),
    destinationUrl: z.string().url().max(2_048).nullable().optional(),
    destinationHeaders: outboundHeadersSchema.optional(),
    destinationTimeoutMs: z.number().int().min(1_000).max(30_000).optional(),
    retryMaxAttempts: z.number().int().min(1).max(8).optional(),
    retryBaseDelayMs: z.number().int().min(1_000).max(300_000).optional(),
    retryMaxDelayMs: z.number().int().min(5_000).max(3_600_000).optional(),
    contract: webhookContractSchema.nullable().optional(),
    signatureProvider: z.enum(['none', 'github', 'stripe']).optional(),
    signatureSecret: z.string().min(8).max(512).nullable().optional(),
    signatureToleranceSeconds: z.number().int().min(30).max(3_600).optional(),
    destinationExpectedMinStatus: z.number().int().min(100).max(599).optional(),
    destinationExpectedMaxStatus: z.number().int().min(100).max(599).optional(),
    allowPrivateNetworks: z.boolean().optional(),
    allowedPrivateCidrs: z.array(z.string().max(64)).max(16).optional(),
    confirmProductionImpact: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
  .refine((value) => !value.allowPrivateNetworks || (value.allowedPrivateCidrs?.length ?? 0) > 0, {
    message: 'Private network access requires at least one CIDR',
    path: ['allowedPrivateCidrs'],
  });

export const deliveryActionInputSchema = z.object({
  confirm: z.literal(true),
});

export const alertChannelInputSchema = z
  .object({
    url: z.string().url().max(2_048),
    headers: outboundHeadersSchema.default({}),
    active: z.boolean().default(true),
    allowPrivateNetworks: z.boolean().default(false),
    allowedPrivateCidrs: z.array(z.string().max(64)).max(16).default([]),
  })
  .refine((value) => !value.allowPrivateNetworks || value.allowedPrivateCidrs.length > 0, {
    message: 'Private network access requires at least one CIDR',
    path: ['allowedPrivateCidrs'],
  });

export const shareEvidenceInputSchema = z.object({
  expiresInHours: z.number().int().min(1).max(168).default(24),
  confirm: z.literal(true),
});

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

const monitorInputBaseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  resourceType: z.enum([
    'external_api',
    'internal_api',
    'http_route',
    'webhook_destination',
    'icmp_host',
  ]),
  protocol: z.enum(['http', 'icmp']).default('http'),
  environment: z.enum(['test', 'staging', 'production']).default('test'),
  url: z.string().trim().min(1).max(2_048),
  method: z.enum(['GET', 'HEAD', 'POST']).default('GET'),
  intervalSeconds: z.union([z.literal(60), z.literal(300), z.literal(900)]).default(300),
  timeoutMs: z.number().int().min(1_000).max(30_000).default(10_000),
  expectedMinStatus: z.number().int().min(100).max(599).default(200),
  expectedMaxStatus: z.number().int().min(100).max(599).default(299),
  expectedText: z.string().max(256).optional(),
  expectedJsonPath: z
    .string()
    .regex(/^\$(?:\.[A-Za-z_][A-Za-z0-9_-]*){1,8}$/)
    .optional(),
  headers: outboundHeadersSchema.default({}),
  consecutiveFailuresToOpen: z.number().int().min(1).max(10).default(2),
  allowPrivateNetworks: z.boolean().default(false),
  allowedPrivateCidrs: z.array(z.string().max(64)).max(16).default([]),
});

export const monitorInputSchema = monitorInputBaseSchema
  .refine(
    (value) => {
      if (value.protocol === 'icmp') {
        return (
          value.resourceType === 'icmp_host' &&
          /^(?:icmp:\/\/)?(?:\[[0-9a-fA-F:]+\]|[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?)$/.test(
            value.url,
          )
        );
      }
      return value.resourceType !== 'icmp_host' && /^https?:\/\/[^\s]+$/i.test(value.url);
    },
    { message: 'Target does not match the selected monitor protocol', path: ['url'] },
  )
  .refine((value) => value.expectedMinStatus <= value.expectedMaxStatus, {
    message: 'Expected minimum status must not exceed maximum status',
    path: ['expectedMaxStatus'],
  })
  .refine((value) => !value.allowPrivateNetworks || value.allowedPrivateCidrs.length > 0, {
    message: 'Private network access requires at least one CIDR',
    path: ['allowedPrivateCidrs'],
  });

export const updateMonitorInputSchema = monitorInputBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const statusPageBaseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  headline: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().default(null),
  accentColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#36e37e'),
  monitorIds: z.array(z.string().uuid()).min(1).max(25),
  enabled: z.boolean().default(true),
});

export const statusPageInputSchema = statusPageBaseSchema;
export const updateStatusPageInputSchema = statusPageBaseSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type CreateEndpointInput = z.infer<typeof createEndpointInputSchema>;
export type UpdateEndpointInput = z.infer<typeof updateEndpointInputSchema>;
export type DeliveryActionInput = z.infer<typeof deliveryActionInputSchema>;
export type WebhookContract = z.infer<typeof webhookContractSchema>;
export type AlertChannelInput = z.infer<typeof alertChannelInputSchema>;
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
export type MonitorInput = z.infer<typeof monitorInputSchema>;
export type UpdateMonitorInput = z.infer<typeof updateMonitorInputSchema>;
export type StatusPageInput = z.infer<typeof statusPageInputSchema>;
export type UpdateStatusPageInput = z.infer<typeof updateStatusPageInputSchema>;
