import { z } from 'zod';

const runtimeConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DEPLOYMENT_MODE: z.enum(['cloud', 'selfhost']).default('selfhost'),
    REGISTRATION_MODE: z.enum(['open', 'first-user', 'closed']).default('first-user'),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    APP_ORIGIN: z.string().url(),
    API_ORIGIN: z.string().url(),
    INGEST_ORIGIN: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    PAYLOAD_ENCRYPTION_KEY: z.string().min(32),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    INGEST_HOST: z.string().default('0.0.0.0'),
    INGEST_PORT: z.coerce.number().int().min(1).max(65_535).default(3002),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    MAX_BODY_BYTES: z.coerce.number().int().positive().default(524_288),
    EVENT_RETENTION_HOURS: z.coerce.number().int().positive().default(72),
    ENDPOINTS_LIMIT: z.coerce.number().int().nonnegative().default(0),
    MONITORS_LIMIT: z.coerce.number().int().nonnegative().default(0),
    DAILY_EVENTS_LIMIT: z.coerce.number().int().nonnegative().default(0),
    MAILEROO_API_KEY: z.string().default(''),
    MAILEROO_BASE_URL: z.string().url().default('https://smtp.maileroo.com/api/v2'),
    MAIL_FROM_ADDRESS: z.string().email().default('noreply@hooktrials.com'),
    MAIL_FROM_NAME: z.string().min(1).max(80).default('HookTrials'),
    MAIL_REPLY_TO: z
      .union([z.string().email(), z.literal('')])
      .optional()
      .transform((value) => value || undefined),
    AUTH_EMAIL_VERIFICATION_REQUIRED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    AUTH_EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
    AUTH_PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(10).max(120).default(60),
  })
  .superRefine((value, context) => {
    if (value.AUTH_EMAIL_VERIFICATION_REQUIRED && !value.MAILEROO_API_KEY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MAILEROO_API_KEY'],
        message: 'Maileroo API key is required when email verification is enforced',
      });
    }
  });

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export function readRuntimeConfig(source: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return runtimeConfigSchema.parse(source);
}
