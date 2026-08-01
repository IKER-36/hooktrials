import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { createHmac, randomBytes } from 'node:crypto';
import { readRuntimeConfig } from '@hooktrials/config';
import {
  createEndpointInputSchema,
  alertChannelInputSchema,
  accountEmailInputSchema,
  accountPasswordInputSchema,
  accountProfileInputSchema,
  auditQuerySchema,
  authTokenInputSchema,
  destinationPreflightInputSchema,
  deliveryPolicyInputSchema,
  deliveryActionInputSchema,
  emailInputSchema,
  evidenceExportQuerySchema,
  evidenceListQuerySchema,
  incidentTriageInputSchema,
  loginInputSchema,
  monitorInputSchema,
  onboardingInputSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  scenarioInputSchema,
  shareEvidenceInputSchema,
  statusPageInputSchema,
  syntheticEventInputSchema,
  updateMonitorInputSchema,
  updateStatusPageInputSchema,
  updateEndpointInputSchema,
  apiKeyInputSchema,
  reliabilityQuerySchema,
  workspaceInviteAcceptSchema,
  workspaceInviteInputSchema,
  workspaceRoleUpdateSchema,
} from '@hooktrials/contracts';
import { decryptValue, encryptValue, sha256 } from '@hooktrials/crypto';
import {
  attempts,
  authTokens,
  alertChannels,
  alertDeliveries,
  apiKeys,
  auditEvents,
  createDatabase,
  destinationDeliveries,
  endpoints,
  events,
  incidents,
  integrationResources,
  monitorChecks,
  monitors,
  reports,
  sessions,
  scenarios,
  statusPageMonitors,
  statusPages,
  users,
  workspaceInvites,
  workspaceMembers,
  workspaces,
} from '@hooktrials/database';
import { createLogger, redactHeaders } from '@hooktrials/logger';
import {
  buildTestAlertPayload,
  buildReliabilityReplay,
  calculateIntegrationReadiness,
  calculateMonitorScore,
  calculateWebhookScore,
} from '@hooktrials/integration-engine';
import { percentile } from '@hooktrials/monitor-engine';
import {
  NetworkPolicyError,
  safeRequest,
  validateHostTarget,
  validateTarget,
} from '@hooktrials/network-policy';
import { builtInScenarios } from '@hooktrials/scenario-engine';
import argon2 from 'argon2';
import { Queue } from 'bullmq';
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import { nanoid } from 'nanoid';
import { ZodError } from 'zod';
import {
  clearSession,
  createSession,
  getAuthenticatedPrincipal,
  hashToken,
  setSessionCookie,
} from './auth.js';
import { hashAuthToken, issueAuthToken } from './email/tokens.js';
import { buildOpenApiDocument } from './openapi.js';
import {
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
  welcomeEmail,
} from './email/templates.js';
import { createMailer } from './email/mailer.js';
import { acquireDemoMutationLock } from './demo-lock.js';
import {
  evidenceFilename,
  evidenceJson,
  evidenceMarkdown,
  type RedactedEvidence,
} from './evidence.js';

const config = readRuntimeConfig();
const externalAccess = !['localhost', '127.0.0.1', '::1'].includes(
  new URL(config.APP_ORIGIN).hostname,
);
const logger = createLogger(config.LOG_LEVEL);
const database = createDatabase(config.DATABASE_URL);
const mailer = createMailer(config, logger);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const deliveryQueue = new Queue('destination-deliveries', { connection: redis });
const monitorQueue = new Queue('monitor-checks', { connection: redis });

const builtInScenarioIds = {
  inspection: '00000000-0000-4000-8000-000000000001',
  temporaryOutage: '00000000-0000-4000-8000-000000000002',
  rateLimited: '00000000-0000-4000-8000-000000000003',
  unstable: '00000000-0000-4000-8000-000000000004',
} as const;

async function ensureBuiltInScenarios() {
  for (const [key, definition] of Object.entries(builtInScenarios)) {
    const id = builtInScenarioIds[key as keyof typeof builtInScenarioIds];
    if (!id) continue;
    await database.db
      .insert(scenarios)
      .values({ id, name: definition.name, definition, builtIn: true })
      .onConflictDoUpdate({
        target: scenarios.id,
        set: { name: definition.name, definition, builtIn: true, updatedAt: new Date() },
      });
  }
}

await ensureBuiltInScenarios();

const app = Fastify({ loggerInstance: logger, trustProxy: config.TRUST_PROXY_HOPS });
const allowedOrigins = new Set([config.APP_ORIGIN]);
if (config.NODE_ENV === 'development') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
  allowedOrigins.add('http://localhost:8080');
  allowedOrigins.add('http://127.0.0.1:8080');
}

await app.register(cookie);
await app.register(cors, {
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
});
await app.register(helmet);
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

app.addHook('onSend', async (request, reply, payload) => {
  if (request.url.startsWith('/v1/')) reply.header('cache-control', 'no-store');
  return payload;
});

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: 'validation_error', issues: error.issues });
  }
  if (error instanceof NetworkPolicyError) {
    return reply
      .code(400)
      .send({ error: 'target_blocked', category: error.category, message: error.message });
  }
  request.log.error({ error }, 'Request failed');
  return reply.code(500).send({ error: 'internal_error' });
});

app.addHook('onRequest', async (request, reply) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    return reply.code(403).send({ error: 'origin_not_allowed' });
  }
});

const uuidSegment = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkspaceRole = 'owner' | 'admin' | 'operator' | 'viewer';
type SessionUser = Pick<
  typeof users.$inferSelect,
  | 'id'
  | 'email'
  | 'displayName'
  | 'role'
  | 'emailVerified'
  | 'emailVerificationRequired'
  | 'pendingEmail'
  | 'avatarUrl'
  | 'onboardingCompletedAt'
>;
type WorkspaceAwareUser = SessionUser & {
  workspaceId: string;
  workspaceOwnerId: string;
  workspaceUserIds: string[];
  workspaceRole: WorkspaceRole;
};

async function attachWorkspaceContext(user: SessionUser) {
  const membership = (
    await database.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        ownerUserId: workspaces.ownerUserId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, user.id))
      // A newly accepted invite becomes the active workspace for the session.
      // This keeps the first release simple while allowing a user to retain an
      // empty personal workspace for later workspace switching.
      .orderBy(desc(workspaceMembers.createdAt))
      .limit(1)
  )[0];
  if (!membership) return null;
  const members = await database.db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, membership.workspaceId));
  return {
    ...user,
    workspaceId: membership.workspaceId,
    workspaceOwnerId: membership.ownerUserId,
    workspaceUserIds: [...new Set(members.map((member) => member.userId))],
    workspaceRole: membership.role,
  } satisfies WorkspaceAwareUser;
}

function operatorMutationAllowed(path: string) {
  return (
    /^\/v1\/(incidents|deliveries)\//.test(path) ||
    /^\/v1\/monitors\/[^/]+\/(pause|resume)$/.test(path) ||
    /^\/v1\/automation\//.test(path) ||
    /^\/v1\/endpoints\/[^/]+\/test-event$/.test(path) ||
    /^\/v1\/alert-channel\/test$/.test(path) ||
    /^\/v1\/events\/[^/]+\/(share)$/.test(path) ||
    /^\/v1\/me\/onboarding$/.test(path) ||
    /^\/v1\/me\/(profile|email|password|sessions(?:\/|$))/.test(path) ||
    /^\/v1\/workspace\/invites\/accept$/.test(path)
  );
}

app.addHook('onResponse', async (request, reply) => {
  const path = request.url.split('?')[0] ?? request.url;
  if (!path.startsWith('/v1/') || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return;
  }
  if (path.startsWith('/v1/auth/')) return;
  try {
    const principal = await getAuthenticatedPrincipal(database.db, request);
    if (!principal) return;
    const segments = path.split('/').filter(Boolean);
    const entityType = (segments[1] ?? 'request').slice(0, 40);
    const entityId = segments.find((segment) => uuidSegment.test(segment)) ?? null;
    await database.db.insert(auditEvents).values({
      userId: principal.user.id,
      actorType: principal.authType,
      action: `${request.method.toLowerCase()} ${path}`.slice(0, 80),
      entityType,
      entityId,
      statusCode: reply.statusCode,
      metadata: { source: principal.authType },
    });
  } catch (error) {
    request.log.warn({ error }, 'Audit event could not be recorded');
  }
});

async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const principal = await getAuthenticatedPrincipal(database.db, request);
  if (!principal || principal.authType !== 'session') {
    await reply.code(401).send({ error: 'authentication_required' });
    return null;
  }
  const user = principal.user;
  if (user.emailVerificationRequired && !user.emailVerified) {
    await reply.code(403).send({ error: 'email_not_verified' });
    return null;
  }
  const scopedUser = await attachWorkspaceContext(user);
  if (!scopedUser) {
    await reply.code(403).send({ error: 'workspace_membership_required' });
    return null;
  }
  const path = request.url.split('?')[0] ?? request.url;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    if (scopedUser.workspaceRole === 'viewer' && !operatorMutationAllowed(path)) {
      await reply.code(403).send({ error: 'workspace_read_only' });
      return null;
    }
    if (scopedUser.workspaceRole === 'operator' && !operatorMutationAllowed(path)) {
      await reply.code(403).send({ error: 'workspace_role_required', role: 'admin' });
      return null;
    }
  }
  return scopedUser;
}

async function requireWorkspaceAdmin(user: WorkspaceAwareUser, reply: FastifyReply) {
  if (!['owner', 'admin'].includes(user.workspaceRole)) {
    await reply.code(403).send({ error: 'workspace_role_required', role: 'admin' });
    return false;
  }
  return true;
}

async function requireApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
  scope: 'read' | 'write',
) {
  const principal = await getAuthenticatedPrincipal(database.db, request);
  if (!principal || principal.authType !== 'api_key') {
    await reply.code(401).send({ error: 'api_key_required' });
    return null;
  }
  if (!principal.scopes.includes(scope)) {
    await reply.code(403).send({ error: 'api_key_scope_required', scope });
    return null;
  }
  if (principal.user.emailVerificationRequired && !principal.user.emailVerified) {
    await reply.code(403).send({ error: 'email_not_verified' });
    return null;
  }
  return principal.user;
}

function publicUser(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  onboardingCompletedAt: Date | null;
  emailVerified?: boolean;
  emailVerificationRequired?: boolean;
  pendingEmail?: string | null;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    onboardingCompletedAt: user.onboardingCompletedAt,
    emailVerified: user.emailVerified ?? false,
    emailVerificationRequired: user.emailVerificationRequired ?? false,
    pendingEmail: user.pendingEmail ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

async function sendVerificationMessage(
  user: { id: string; email: string; displayName: string },
  options: { email?: string; purpose?: 'email_verification' | 'email_change'; tag?: string } = {},
) {
  const targetEmail = options.email ?? user.email;
  const purpose = options.purpose ?? 'email_verification';
  const token = await issueAuthToken(
    database.db,
    user.id,
    purpose,
    new Date(Date.now() + config.AUTH_EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1_000),
  );
  const verifyUrl = `${config.APP_ORIGIN.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  return mailer.send({
    to: { address: targetEmail, display_name: user.displayName },
    tag: options.tag ?? 'email-verification',
    email: verificationEmail({
      name: user.displayName,
      verifyUrl,
      origin: config.APP_ORIGIN,
      ttlHours: config.AUTH_EMAIL_VERIFICATION_TTL_HOURS,
    }),
  });
}

async function sendPasswordResetMessage(user: { id: string; email: string; displayName: string }) {
  const token = await issueAuthToken(
    database.db,
    user.id,
    'password_reset',
    new Date(Date.now() + config.AUTH_PASSWORD_RESET_TTL_MINUTES * 60 * 1_000),
  );
  const resetUrl = `${config.APP_ORIGIN.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
  return mailer.send({
    to: { address: user.email, display_name: user.displayName },
    tag: 'password-reset',
    email: passwordResetEmail({
      name: user.displayName,
      resetUrl,
      origin: config.APP_ORIGIN,
      ttlMinutes: config.AUTH_PASSWORD_RESET_TTL_MINUTES,
    }),
  });
}

function decryptToken(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptValue(value, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8');
  } catch {
    return null;
  }
}

function setSyntheticJsonPath(
  target: Record<string, unknown>,
  path: string,
  value: string | number | boolean | null,
) {
  const segments = path.slice(2).split('.');
  let current = target;
  for (const [index, segment] of segments.entries()) {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    const existing = current[segment];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
}

type SyntheticMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type SyntheticContract = {
  method?: SyntheticMethod;
  requiredHeaders?: Record<string, string>;
  jsonPaths?: Record<string, string | number | boolean | null>;
};

function syntheticIngestTarget(token: string) {
  if (config.NODE_ENV === 'development') {
    return {
      url: `http://127.0.0.1:${config.INGEST_PORT}/i/${token}`,
      network: {
        allowHttp: true,
        allowPrivateNetworks: true,
        allowedPrivateCidrs: ['127.0.0.1/32'],
      },
    };
  }
  return {
    url: `http://ingestor:${config.INGEST_PORT}/i/${token}`,
    network: {
      allowHttp: true,
      allowPrivateNetworks: true,
      allowedPrivateCidrs: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
    },
  };
}

function syntheticProviderHeaders(input: {
  provider: string;
  eventId: string;
  body: Buffer;
  signatureProvider: 'none' | 'github' | 'stripe';
  signatureSecret: string | null;
}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-event-id': input.eventId,
    'x-hooktrials-test-event': 'true',
  };

  if (input.provider === 'github') {
    headers['x-github-event'] = 'ping';
    headers['x-github-delivery'] = input.eventId;
    headers['x-hub-signature-256'] =
      input.signatureProvider === 'github' && input.signatureSecret
        ? `sha256=${createHmac('sha256', input.signatureSecret).update(input.body).digest('hex')}`
        : 'sha256=synthetic-not-configured';
  }
  if (input.provider === 'stripe') {
    const timestamp = Math.floor(Date.now() / 1_000);
    const signature =
      input.signatureProvider === 'stripe' && input.signatureSecret
        ? createHmac('sha256', input.signatureSecret)
            .update(`${timestamp}.`)
            .update(input.body)
            .digest('hex')
        : 'synthetic-not-configured';
    headers['stripe-signature'] = `t=${timestamp},v1=${signature}`;
  }
  if (input.provider === 'shopify') {
    headers['x-shopify-topic'] = 'hooktrials/test';
    headers['x-shopify-webhook-id'] = input.eventId;
    headers['x-shopify-hmac-sha256'] = 'synthetic-test';
  }
  if (input.provider === 'slack') {
    headers['x-slack-request-timestamp'] = String(Math.floor(Date.now() / 1_000));
    headers['x-slack-signature'] = 'v0=synthetic-test';
  }
  if (input.provider === 'gitlab') {
    headers['x-gitlab-event'] = 'Push Hook';
    headers['x-gitlab-webhook-uuid'] = input.eventId;
    headers['x-gitlab-token'] = 'synthetic-test';
  }
  if (input.provider === 'linear') {
    headers['linear-event'] = 'Issue';
    headers['linear-delivery'] = input.eventId;
    headers['linear-signature'] = 'synthetic-test';
    headers['linear-timestamp'] = String(Date.now());
  }
  if (input.provider === 'hubspot') {
    headers['x-hubspot-signature-v3'] = 'synthetic-test';
    headers['x-hubspot-request-timestamp'] = String(Date.now());
  }

  return headers;
}

function safeHeaders(value: unknown): Record<string, string | string[]> {
  return redactHeaders(value);
}

function monitorNetworkOptions(input: {
  allowPrivateNetworks: boolean;
  allowedPrivateCidrs: string[];
}) {
  if (config.DEPLOYMENT_MODE === 'cloud' && input.allowPrivateNetworks) {
    throw new NetworkPolicyError('blocked', 'Private network monitoring is disabled in Cloud');
  }
  return {
    allowHttp: config.DEPLOYMENT_MODE === 'selfhost' && input.allowPrivateNetworks,
    allowPrivateNetworks: config.DEPLOYMENT_MODE === 'selfhost' && input.allowPrivateNetworks,
    allowedPrivateCidrs: input.allowedPrivateCidrs,
  };
}

function encryptedMonitorHeaders(headers: Record<string, string>): string | null {
  if (Object.keys(headers).length === 0) return null;
  return encryptValue(JSON.stringify(headers), config.PAYLOAD_ENCRYPTION_KEY);
}

function encryptHeaders(headers: Record<string, string>): string | null {
  return encryptedMonitorHeaders(headers);
}

type StoredDeliveryDestination = {
  id: string;
  name: string;
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
  expectedMinStatus: number;
  expectedMaxStatus: number;
  active: boolean;
};
type StoredDeliveryPolicy = {
  strategy: 'single' | 'fanout' | 'failover';
  idempotencyScope: 'destination' | 'event';
  destinations: StoredDeliveryDestination[];
};

function legacyDeliveryPolicy(input: {
  url: string | null;
  headers?: Record<string, string>;
  timeoutMs?: number;
  expectedMinStatus?: number;
  expectedMaxStatus?: number;
}): StoredDeliveryPolicy | null {
  if (!input.url) return null;
  return {
    strategy: 'single',
    idempotencyScope: 'destination',
    destinations: [
      {
        id: 'primary',
        name: 'Primary destination',
        url: input.url,
        headers: input.headers ?? {},
        timeoutMs: input.timeoutMs ?? 10_000,
        expectedMinStatus: input.expectedMinStatus ?? 200,
        expectedMaxStatus: input.expectedMaxStatus ?? 299,
        active: true,
      },
    ],
  };
}

async function prepareDeliveryPolicy(
  input: unknown,
  fallback: StoredDeliveryPolicy | null,
): Promise<StoredDeliveryPolicy | null> {
  if (input === undefined) return fallback;
  if (input === null) return null;
  const parsed = deliveryPolicyInputSchema.parse(input);
  const destinations = await Promise.all(
    parsed.destinations.map(async (destination, index) => {
      await validateTarget(
        destination.url,
        monitorNetworkOptions({ allowPrivateNetworks: false, allowedPrivateCidrs: [] }),
      );
      return {
        id: destination.id ?? `destination-${index + 1}-${nanoid(6)}`,
        name: destination.name,
        url: destination.url,
        headers: destination.headers,
        timeoutMs: destination.timeoutMs,
        expectedMinStatus: destination.expectedMinStatus,
        expectedMaxStatus: destination.expectedMaxStatus,
        active: destination.active,
      } satisfies StoredDeliveryDestination;
    }),
  );
  return {
    strategy: parsed.strategy,
    idempotencyScope: parsed.idempotencyScope,
    destinations,
  };
}

function encryptDeliveryPolicy(policy: StoredDeliveryPolicy | null): string | null {
  return policy ? encryptValue(JSON.stringify(policy), config.PAYLOAD_ENCRYPTION_KEY) : null;
}

function decryptDeliveryPolicy(value: string | null): StoredDeliveryPolicy | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(
      decryptValue(value, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8'),
    ) as StoredDeliveryPolicy;
    return parsed && Array.isArray(parsed.destinations) ? parsed : null;
  } catch {
    return null;
  }
}

function deliveryPolicySummary(
  policy: StoredDeliveryPolicy | null,
  legacy: { host: string | null },
) {
  if (!policy) {
    return {
      deliveryStrategy: 'single' as const,
      idempotencyScope: 'destination' as const,
      destinationCount: legacy.host ? 1 : 0,
      deliveryDestinations: legacy.host
        ? [{ id: 'primary', name: 'Primary destination', host: legacy.host, active: true }]
        : [],
    };
  }
  return {
    deliveryStrategy: policy.strategy,
    idempotencyScope: policy.idempotencyScope,
    destinationCount: policy.destinations.length,
    deliveryDestinations: policy.destinations.map((destination) => ({
      id: destination.id,
      name: destination.name,
      host: new URL(destination.url).host,
      active: destination.active,
    })),
  };
}

function decryptedMonitorHeaders(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(
      decryptValue(value, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8'),
    ) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  } catch {
    return {};
  }
}

function monitorDisplayUrl(input: string): string {
  const url = new URL(input);
  return `${url.origin}${url.pathname}`;
}

function normalizeMonitorTarget(protocol: 'http' | 'icmp', input: string): string {
  if (protocol === 'http') return input;
  return input
    .trim()
    .replace(/^icmp:\/\//i, '')
    .replace(/^\[|\]$/g, '');
}

async function validateMonitorTarget(input: {
  protocol: 'http' | 'icmp';
  url: string;
  allowPrivateNetworks: boolean;
  allowedPrivateCidrs: string[];
}) {
  const options = monitorNetworkOptions(input);
  if (input.protocol === 'icmp') return validateHostTarget(input.url, options);
  return validateTarget(input.url, options);
}

function monitorTargetPresentation(protocol: 'http' | 'icmp', input: string) {
  if (protocol === 'icmp') {
    const hostname = normalizeMonitorTarget(protocol, input);
    return { displayHost: hostname, displayUrl: `icmp://${hostname}` };
  }
  const url = new URL(input);
  return { displayHost: url.host, displayUrl: monitorDisplayUrl(input) };
}

function monitorMetrics(
  checks: Array<{
    outcome: 'healthy' | 'degraded' | 'down';
    latencyMs: number | null;
    startedAt: Date;
    statusCode: number | null;
    errorCategory: string | null;
  }>,
) {
  const now = Date.now();
  const checks24h = checks.filter(
    (check) => check.startedAt.getTime() >= now - 24 * 60 * 60 * 1_000,
  );
  const checks1h = checks24h.filter((check) => check.startedAt.getTime() >= now - 60 * 60 * 1_000);
  const availability = (windowChecks: Array<{ outcome: 'healthy' | 'degraded' | 'down' }>) => {
    if (windowChecks.length === 0) return null;
    const healthy = windowChecks.filter((check) => check.outcome === 'healthy').length;
    return Math.round((healthy / windowChecks.length) * 10_000) / 100;
  };
  const latencies = checks24h
    .map((check) => check.latencyMs)
    .filter((value): value is number => value !== null);
  const latest = checks.at(-1) ?? null;
  return {
    checks24h: checks24h.length,
    availability1h: availability(checks1h),
    availability24h: availability(checks24h),
    averageLatencyMs:
      latencies.length === 0
        ? null
        : Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length),
    p95LatencyMs: percentile(latencies, 0.95),
    latest: latest
      ? {
          outcome: latest.outcome,
          latencyMs: latest.latencyMs,
          statusCode: latest.statusCode,
          errorCategory: latest.errorCategory,
          startedAt: latest.startedAt,
        }
      : null,
  };
}

app.get('/healthz', async () => ({
  service: 'api',
  status: 'ok' as const,
  timestamp: new Date().toISOString(),
}));

const openApiDocument = buildOpenApiDocument(config.API_ORIGIN);
app.get('/openapi.json', async (_request, reply) => {
  return reply.header('cache-control', 'public, max-age=300').send(openApiDocument);
});
app.get('/v1/openapi.json', async (_request, reply) => {
  return reply.header('cache-control', 'public, max-age=300').send(openApiDocument);
});

app.get('/v1/setup', async () => {
  const result = await database.db.select({ value: count() }).from(users);
  const setupRequired = (result[0]?.value ?? 0) === 0;
  return {
    deploymentMode: config.DEPLOYMENT_MODE,
    registrationOpen:
      config.REGISTRATION_MODE === 'open' ||
      (config.REGISTRATION_MODE === 'first-user' && setupRequired),
    setupRequired,
    publicOrigin: config.APP_ORIGIN,
    externalAccess,
  };
});

app.post(
  '/v1/auth/register',
  { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
  async (request, reply) => {
    const input = registerInputSchema.parse(request.body);
    const email = input.email.trim().toLowerCase();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await database.db
      .transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(4815162342)`);
        const existing = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (existing.length > 0) return null;

        const userCount = await tx.select({ value: count() }).from(users);
        const firstUser = (userCount[0]?.value ?? 0) === 0;
        if (
          config.REGISTRATION_MODE === 'closed' ||
          (config.REGISTRATION_MODE === 'first-user' && !firstUser)
        ) {
          throw new Error('registration_closed');
        }

        const created = await tx
          .insert(users)
          .values({
            email,
            displayName: input.displayName,
            passwordHash,
            role: config.REGISTRATION_MODE === 'first-user' && firstUser ? 'admin' : 'user',
            emailVerificationRequired: config.AUTH_EMAIL_VERIFICATION_REQUIRED,
          })
          .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            role: users.role,
            emailVerified: users.emailVerified,
            emailVerificationRequired: users.emailVerificationRequired,
            pendingEmail: users.pendingEmail,
            avatarUrl: users.avatarUrl,
            onboardingCompletedAt: users.onboardingCompletedAt,
          });
        const createdUser = created[0] ?? null;
        if (!createdUser) return null;
        const workspace = (
          await tx
            .insert(workspaces)
            .values({
              ownerUserId: createdUser.id,
              name: `${input.displayName.trim()}'s workspace`.slice(0, 80),
            })
            .returning({ id: workspaces.id })
        )[0];
        if (!workspace) throw new Error('Workspace creation returned no record');
        await tx.insert(workspaceMembers).values({
          workspaceId: workspace.id,
          userId: createdUser.id,
          role: 'owner',
        });
        return createdUser;
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'registration_closed')
          return 'closed' as const;
        throw error;
      });

    if (user === 'closed') return reply.code(403).send({ error: 'registration_closed' });
    if (!user) return reply.code(409).send({ error: 'email_already_registered' });
    if (!user) throw new Error('User creation returned no record');

    const emailVerificationRequired = user.emailVerificationRequired;
    const emailVerificationEnabled = emailVerificationRequired || Boolean(config.MAILEROO_API_KEY);
    const emailVerificationSent = emailVerificationEnabled
      ? await sendVerificationMessage(user)
      : false;
    if (emailVerificationRequired) {
      return reply.code(201).send({
        user: null,
        emailVerificationRequired: true,
        emailVerificationSent,
      });
    }

    const session = await createSession(database.db, user.id);
    setSessionCookie(reply, session.token, session.expiresAt, config.COOKIE_SECURE);
    return reply.code(201).send({
      user: publicUser(user),
      emailVerificationRequired: false,
      emailVerificationSent,
    });
  },
);

app.post(
  '/v1/auth/login',
  { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
  async (request, reply) => {
    const input = loginInputSchema.parse(request.body);
    const email = input.email.trim().toLowerCase();
    const result = await database.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];
    if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }

    if (user.emailVerificationRequired && !user.emailVerified) {
      await sendVerificationMessage(user);
      return reply.code(403).send({ error: 'email_not_verified' });
    }

    const session = await createSession(database.db, user.id);
    setSessionCookie(reply, session.token, session.expiresAt, config.COOKIE_SECURE);
    return {
      user: publicUser(user),
    };
  },
);

app.post(
  '/v1/auth/resend-verification',
  { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } },
  async (request, reply) => {
    const input = emailInputSchema.parse(request.body);
    const email = input.email.trim().toLowerCase();
    const result = await database.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];
    if (
      user &&
      !user.emailVerified &&
      (user.emailVerificationRequired || config.MAILEROO_API_KEY)
    ) {
      await sendVerificationMessage(user);
    }
    return reply.code(202).send({ accepted: true });
  },
);

app.post(
  '/v1/auth/verify-email',
  { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
  async (request, reply) => {
    const { token } = authTokenInputSchema.parse(request.body);
    const result = await database.db
      .select({
        tokenId: authTokens.id,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        emailVerified: users.emailVerified,
        emailVerificationRequired: users.emailVerificationRequired,
        pendingEmail: users.pendingEmail,
        avatarUrl: users.avatarUrl,
        purpose: authTokens.purpose,
      })
      .from(authTokens)
      .innerJoin(users, eq(authTokens.userId, users.id))
      .where(
        and(
          eq(authTokens.tokenHash, hashAuthToken(token)),
          inArray(authTokens.purpose, ['email_verification', 'email_change']),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const record = result[0];
    if (!record) return reply.code(400).send({ error: 'email_verification_invalid' });
    if (record.purpose === 'email_change') {
      if (!record.pendingEmail)
        return reply.code(400).send({ error: 'email_verification_invalid' });
      const existing = await database.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, record.pendingEmail))
        .limit(1);
      if (existing[0] && existing[0].id !== record.userId) {
        return reply.code(409).send({ error: 'email_already_registered' });
      }
    }

    const now = new Date();
    await database.db.transaction(async (tx) => {
      await tx.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, record.tokenId));
      const emailUpdate =
        record.purpose === 'email_change' && record.pendingEmail
          ? { email: record.pendingEmail, pendingEmail: null, emailVerified: true, updatedAt: now }
          : { emailVerified: true, updatedAt: now };
      await tx.update(users).set(emailUpdate).where(eq(users.id, record.userId));
    });
    if (!record.emailVerified && record.purpose === 'email_verification') {
      await mailer.send({
        to: { address: record.email, display_name: record.displayName },
        tag: 'welcome',
        email: welcomeEmail({ name: record.displayName, origin: config.APP_ORIGIN }),
      });
    }
    return { verified: true };
  },
);

app.post(
  '/v1/auth/forgot-password',
  { config: { rateLimit: { max: 3, timeWindow: '15 minutes' } } },
  async (request, reply) => {
    const input = emailInputSchema.parse(request.body);
    const email = input.email.trim().toLowerCase();
    const result = await database.db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0];
    if (user && config.MAILEROO_API_KEY) await sendPasswordResetMessage(user);
    // Always return the same response so account existence cannot be enumerated.
    return reply.code(202).send({ accepted: true });
  },
);

app.post(
  '/v1/auth/reset-password',
  { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
  async (request, reply) => {
    const input = resetPasswordInputSchema.parse(request.body);
    const result = await database.db
      .select({
        tokenId: authTokens.id,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(authTokens)
      .innerJoin(users, eq(authTokens.userId, users.id))
      .where(
        and(
          eq(authTokens.tokenHash, hashAuthToken(input.token)),
          eq(authTokens.purpose, 'password_reset'),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    const record = result[0];
    if (!record) return reply.code(400).send({ error: 'password_reset_invalid' });

    const now = new Date();
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    await database.db.transaction(async (tx) => {
      await tx.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, record.tokenId));
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: now })
        .where(eq(users.id, record.userId));
      await tx.delete(sessions).where(eq(sessions.userId, record.userId));
    });
    await mailer.send({
      to: { address: record.email, display_name: record.displayName },
      tag: 'password-changed',
      email: passwordChangedEmail({ name: record.displayName, origin: config.APP_ORIGIN }),
    });
    return { reset: true };
  },
);

app.post('/v1/auth/logout', async (request, reply) => {
  await clearSession(database.db, request, reply);
  return reply.code(204).send();
});

app.get('/v1/me', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  return { user };
});

app.get('/v1/me/sessions', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const token = request.cookies.hooktrials_session;
  if (!token) return reply.code(403).send({ error: 'session_auth_required' });
  const current = (
    await database.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, user.id),
          eq(sessions.tokenHash, hashToken(token)),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
  )[0];
  if (!current) return reply.code(403).send({ error: 'session_auth_required' });
  const items = await database.db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .orderBy(desc(sessions.lastSeenAt));
  return { sessions: items.map((item) => ({ ...item, current: item.id === current.id })) };
});

app.delete('/v1/me/sessions/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const token = request.cookies.hooktrials_session;
  if (!token) return reply.code(403).send({ error: 'session_auth_required' });
  const { id } = request.params as { id: string };
  const removed = await database.db
    .delete(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id, tokenHash: sessions.tokenHash });
  const session = removed[0];
  if (!session) return reply.code(404).send({ error: 'session_not_found' });
  if (session.tokenHash === hashToken(token))
    reply.clearCookie('hooktrials_session', { path: '/' });
  return reply.code(204).send();
});

app.post('/v1/me/sessions/revoke-others', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const token = request.cookies.hooktrials_session;
  if (!token) return reply.code(403).send({ error: 'session_auth_required' });
  const current = (
    await database.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, user.id), eq(sessions.tokenHash, hashToken(token))))
      .limit(1)
  )[0];
  if (!current) return reply.code(403).send({ error: 'session_auth_required' });
  const removed = await database.db
    .delete(sessions)
    .where(and(eq(sessions.userId, user.id), ne(sessions.id, current.id)))
    .returning({ id: sessions.id });
  return { revoked: removed.length };
});

app.patch('/v1/me/profile', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = accountProfileInputSchema.parse(request.body);
  const updatedAt = new Date();
  const values = {
    updatedAt,
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
  };
  const updated = (
    await database.db.update(users).set(values).where(eq(users.id, user.id)).returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      emailVerified: users.emailVerified,
      emailVerificationRequired: users.emailVerificationRequired,
      pendingEmail: users.pendingEmail,
      avatarUrl: users.avatarUrl,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
  )[0];
  if (!updated) return reply.code(404).send({ error: 'user_not_found' });
  return { user: publicUser(updated) };
});

app.post(
  '/v1/me/email',
  { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const input = accountEmailInputSchema.parse(request.body);
    const passwordRecord = (
      await database.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
    )[0];
    if (
      !passwordRecord?.passwordHash ||
      !(await argon2.verify(passwordRecord.passwordHash, input.currentPassword))
    ) {
      return reply.code(401).send({ error: 'current_password_invalid' });
    }
    const email = input.email.trim().toLowerCase();
    if (email === user.email) return reply.code(400).send({ error: 'email_same_as_current' });
    const existing = await database.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0] && existing[0].id !== user.id) {
      return reply.code(409).send({ error: 'email_already_registered' });
    }
    const updated = (
      await database.db
        .update(users)
        .set({ pendingEmail: email, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning({
          id: users.id,
          email: users.email,
          displayName: users.displayName,
          role: users.role,
          emailVerified: users.emailVerified,
          emailVerificationRequired: users.emailVerificationRequired,
          pendingEmail: users.pendingEmail,
          avatarUrl: users.avatarUrl,
          onboardingCompletedAt: users.onboardingCompletedAt,
        })
    )[0];
    if (!updated) return reply.code(404).send({ error: 'user_not_found' });
    const emailVerificationSent = await sendVerificationMessage(updated, {
      email,
      purpose: 'email_change',
      tag: 'email-change',
    });
    return { user: publicUser(updated), emailVerificationSent };
  },
);

app.post(
  '/v1/me/password',
  { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const input = accountPasswordInputSchema.parse(request.body);
    const passwordRecord = (
      await database.db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
    )[0];
    if (
      !passwordRecord?.passwordHash ||
      !(await argon2.verify(passwordRecord.passwordHash, input.currentPassword))
    ) {
      return reply.code(401).send({ error: 'current_password_invalid' });
    }
    const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
    await database.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await database.db.delete(sessions).where(eq(sessions.userId, user.id));
    const session = await createSession(database.db, user.id);
    setSessionCookie(reply, session.token, session.expiresAt, config.COOKIE_SECURE);
    await mailer.send({
      to: { address: user.email, display_name: user.displayName },
      tag: 'password-changed',
      email: passwordChangedEmail({ name: user.displayName, origin: config.APP_ORIGIN }),
    });
    return { changed: true };
  },
);

app.get('/v1/workspace', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const [workspace, memberRows, inviteRows] = await Promise.all([
    database.db
      .select({ id: workspaces.id, name: workspaces.name, ownerUserId: workspaces.ownerUserId })
      .from(workspaces)
      .where(eq(workspaces.id, user.workspaceId))
      .limit(1),
    database.db
      .select({
        userId: workspaceMembers.userId,
        email: users.email,
        displayName: users.displayName,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, user.workspaceId))
      .orderBy(asc(workspaceMembers.createdAt)),
    ['owner', 'admin'].includes(user.workspaceRole)
      ? database.db
          .select({
            id: workspaceInvites.id,
            email: workspaceInvites.email,
            role: workspaceInvites.role,
            expiresAt: workspaceInvites.expiresAt,
            createdAt: workspaceInvites.createdAt,
          })
          .from(workspaceInvites)
          .where(
            and(
              eq(workspaceInvites.workspaceId, user.workspaceId),
              isNull(workspaceInvites.acceptedAt),
              gt(workspaceInvites.expiresAt, new Date()),
            ),
          )
          .orderBy(desc(workspaceInvites.createdAt))
      : Promise.resolve([]),
  ]);
  return {
    workspace: workspace[0] ?? null,
    currentRole: user.workspaceRole,
    members: memberRows,
    invites: inviteRows,
  };
});

app.post('/v1/workspace/invites', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  if (!(await requireWorkspaceAdmin(user, reply))) return;
  const input = workspaceInviteInputSchema.parse(request.body);
  const email = input.email.trim().toLowerCase();
  const existing = await database.db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(eq(workspaceMembers.workspaceId, user.workspaceId), eq(users.email, email)))
    .limit(1);
  if (existing[0]) return reply.code(409).send({ error: 'workspace_member_exists' });
  const secret = randomBytes(32).toString('base64url');
  const created = (
    await database.db
      .insert(workspaceInvites)
      .values({
        workspaceId: user.workspaceId,
        email,
        role: input.role,
        tokenHash: sha256(secret),
        invitedByUserId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000),
      })
      .returning({
        id: workspaceInvites.id,
        email: workspaceInvites.email,
        role: workspaceInvites.role,
        expiresAt: workspaceInvites.expiresAt,
        createdAt: workspaceInvites.createdAt,
      })
  )[0];
  if (!created) throw new Error('Workspace invite creation returned no record');
  return reply.code(201).send({ invite: created, token: secret });
});

app.post('/v1/workspace/invites/accept', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { token } = workspaceInviteAcceptSchema.parse(request.body);
  const invite = (
    await database.db
      .select({
        invite: workspaceInvites,
        workspaceName: workspaces.name,
      })
      .from(workspaceInvites)
      .innerJoin(workspaces, eq(workspaceInvites.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceInvites.tokenHash, sha256(token)),
          isNull(workspaceInvites.acceptedAt),
          gt(workspaceInvites.expiresAt, new Date()),
        ),
      )
      .limit(1)
  )[0];
  if (!invite || invite.invite.email !== user.email) {
    return reply.code(400).send({ error: 'workspace_invite_invalid' });
  }
  await database.db.transaction(async (tx) => {
    await tx
      .update(workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, invite.invite.id));
    await tx
      .insert(workspaceMembers)
      .values({
        workspaceId: invite.invite.workspaceId,
        userId: user.id,
        role: invite.invite.role,
      })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { role: invite.invite.role, updatedAt: new Date() },
      });
  });
  return {
    accepted: true,
    workspace: { id: invite.invite.workspaceId, name: invite.workspaceName },
  };
});

app.patch('/v1/workspace/members/:userId', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  if (!(await requireWorkspaceAdmin(user, reply))) return;
  const { userId } = request.params as { userId: string };
  const input = workspaceRoleUpdateSchema.parse(request.body);
  const target = (
    await database.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, user.workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1)
  )[0];
  if (!target || target.role === 'owner')
    return reply.code(404).send({ error: 'workspace_member_not_found' });
  await database.db
    .update(workspaceMembers)
    .set({ role: input.role, updatedAt: new Date() })
    .where(
      and(eq(workspaceMembers.workspaceId, user.workspaceId), eq(workspaceMembers.userId, userId)),
    );
  return { updated: true, userId, role: input.role };
});

app.delete('/v1/workspace/members/:userId', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  if (!(await requireWorkspaceAdmin(user, reply))) return;
  const { userId } = request.params as { userId: string };
  const removed = await database.db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, user.workspaceId),
        eq(workspaceMembers.userId, userId),
        sql`${workspaceMembers.role} <> 'owner'::workspace_role`,
      ),
    )
    .returning({ userId: workspaceMembers.userId });
  if (!removed[0]) return reply.code(404).send({ error: 'workspace_member_not_found' });
  return reply.code(204).send();
});

app.get('/v1/audit-events', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const query = auditQuerySchema.parse(request.query);
  const filters = [inArray(auditEvents.userId, user.workspaceUserIds)];
  if (query.entityType) filters.push(eq(auditEvents.entityType, query.entityType));
  if (query.before) filters.push(lt(auditEvents.createdAt, new Date(query.before)));
  const rows = await database.db
    .select()
    .from(auditEvents)
    .where(and(...filters))
    .orderBy(desc(auditEvents.createdAt))
    .limit(query.limit);
  return {
    events: rows.map((row) => ({
      ...row,
      metadata: row.metadata ?? {},
    })),
    hasMore: rows.length === query.limit,
  };
});

app.get('/v1/evidence', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const query = evidenceListQuerySchema.parse(request.query);
  const filters = [inArray(endpoints.userId, user.workspaceUserIds)];
  if (query.endpointId) filters.push(eq(events.endpointId, query.endpointId));
  if (query.before) filters.push(lt(events.lastSeenAt, new Date(query.before)));
  if (query.status !== 'all') {
    const statusFilter =
      query.status === 'pending'
        ? or(isNull(reports.status), eq(reports.status, 'pending'))
        : eq(reports.status, query.status);
    if (statusFilter) filters.push(statusFilter);
  }

  const rows = await database.db
    .select({
      eventId: events.id,
      endpointId: endpoints.id,
      endpointName: endpoints.name,
      mode: endpoints.mode,
      environment: endpoints.environment,
      correlationKey: events.correlationKey,
      bodyHash: events.bodyHash,
      firstSeenAt: events.firstSeenAt,
      lastSeenAt: events.lastSeenAt,
      reportId: reports.id,
      reportStatus: reports.status,
      reportScore: reports.score,
      reportResult: reports.result,
      reportCreatedAt: reports.createdAt,
      reportCompletedAt: reports.completedAt,
      publicTokenHash: reports.publicTokenHash,
      publicExpiresAt: reports.publicExpiresAt,
    })
    .from(events)
    .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
    .leftJoin(reports, eq(reports.eventId, events.id))
    .where(and(...filters))
    .orderBy(desc(events.lastSeenAt))
    .limit(query.limit);

  const eventIds = rows.map((row) => row.eventId);
  const [attemptRows, deliveryRows] =
    eventIds.length === 0
      ? [[], []]
      : await Promise.all([
          database.db
            .select({
              eventId: attempts.eventId,
              sequence: attempts.sequence,
              receivedAt: attempts.receivedAt,
              responseStatus: attempts.responseStatus,
              responseDelayMs: attempts.responseDelayMs,
              signatureProvider: attempts.signatureProvider,
              signatureStatus: attempts.signatureStatus,
              contractResult: attempts.contractResult,
            })
            .from(attempts)
            .where(inArray(attempts.eventId, eventIds))
            .orderBy(asc(attempts.sequence)),
          database.db
            .select({
              id: destinationDeliveries.id,
              eventId: destinationDeliveries.eventId,
              sequence: destinationDeliveries.sequence,
              kind: destinationDeliveries.kind,
              state: destinationDeliveries.state,
              statusCode: destinationDeliveries.statusCode,
              latencyMs: destinationDeliveries.latencyMs,
              errorCategory: destinationDeliveries.errorCategory,
              startedAt: destinationDeliveries.startedAt,
              completedAt: destinationDeliveries.completedAt,
            })
            .from(destinationDeliveries)
            .where(inArray(destinationDeliveries.eventId, eventIds))
            .orderBy(asc(destinationDeliveries.sequence)),
        ]);
  const attemptsByEvent = new Map<string, typeof attemptRows>();
  const deliveriesByEvent = new Map<string, typeof deliveryRows>();
  for (const row of attemptRows) {
    const items = attemptsByEvent.get(row.eventId) ?? [];
    items.push(row);
    attemptsByEvent.set(row.eventId, items);
  }
  for (const row of deliveryRows) {
    const items = deliveriesByEvent.get(row.eventId) ?? [];
    items.push(row);
    deliveriesByEvent.set(row.eventId, items);
  }
  const now = Date.now();

  return {
    reports: rows.map((row) => {
      const eventAttempts = attemptsByEvent.get(row.eventId) ?? [];
      const eventDeliveries = deliveriesByEvent.get(row.eventId) ?? [];
      const replay = buildReliabilityReplay({
        mode: row.mode,
        attempts: eventAttempts.map((attempt) => ({
          ...attempt,
          contractResult: attempt.contractResult as {
            configured?: boolean;
            passed?: boolean;
          },
        })),
        deliveries: eventDeliveries,
      });
      const latestDelivery = eventDeliveries.at(-1) ?? null;
      return {
        id: row.eventId,
        eventId: row.eventId,
        endpointId: row.endpointId,
        integration: {
          name: row.endpointName,
          mode: row.mode,
          environment: row.environment,
        },
        event: {
          correlationKey: row.correlationKey,
          bodyHash: row.bodyHash,
          firstSeenAt: row.firstSeenAt,
          lastSeenAt: row.lastSeenAt,
        },
        report: {
          id: row.reportId,
          status: row.reportStatus ?? 'pending',
          score: row.reportScore,
          result: row.reportResult,
          createdAt: row.reportCreatedAt,
          completedAt: row.reportCompletedAt,
        },
        attemptCount: eventAttempts.length,
        deliveryCount: eventDeliveries.length,
        latestDelivery,
        share: {
          active: Boolean(
            row.publicTokenHash && row.publicExpiresAt && row.publicExpiresAt.getTime() > now,
          ),
          expiresAt: row.publicExpiresAt,
        },
        replay,
      };
    }),
    hasMore: rows.length === query.limit,
  };
});

app.get('/v1/reliability/summary', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const query = reliabilityQuerySchema.parse(request.query);
  const since = new Date(Date.now() - query.windowDays * 24 * 60 * 60 * 1_000);
  const monitorRows = await database.db
    .select({
      monitor: monitors,
      resourceName: integrationResources.name,
      resourceType: integrationResources.type,
      environment: integrationResources.environment,
    })
    .from(monitors)
    .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
    .where(inArray(integrationResources.userId, user.workspaceUserIds));
  const monitorIds = monitorRows.map((row) => row.monitor.id);
  const checks =
    monitorIds.length === 0
      ? []
      : await database.db
          .select()
          .from(monitorChecks)
          .where(
            and(inArray(monitorChecks.monitorId, monitorIds), gte(monitorChecks.startedAt, since)),
          )
          .orderBy(desc(monitorChecks.startedAt))
          .limit(20_000);
  const resourceIds = monitorRows.map((row) => row.monitor.resourceId);
  const incidentRows =
    resourceIds.length === 0
      ? []
      : await database.db
          .select({ resourceId: incidents.resourceId, status: incidents.status })
          .from(incidents)
          .where(and(inArray(incidents.resourceId, resourceIds), gte(incidents.openedAt, since)));

  function metricsFor(monitorId: string, target: number) {
    const items = checks.filter((check) => check.monitorId === monitorId);
    const latency = items
      .map((check) => check.latencyMs)
      .filter((value): value is number => value !== null);
    const healthy = items.filter((check) => check.outcome === 'healthy').length;
    const availability = items.length === 0 ? null : (healthy / items.length) * 100;
    const failed = items.length - healthy;
    const budgetTotal = items.length * Math.max(0, 1 - target / 100);
    const budgetRemaining = Math.max(0, budgetTotal - failed);
    const budgetRemainingPercent =
      budgetTotal === 0 ? (failed === 0 ? 100 : 0) : (budgetRemaining / budgetTotal) * 100;
    const burnRate =
      items.length === 0 || target >= 100
        ? null
        : failed / items.length / Math.max(0.0001, 1 - target / 100);
    const sloStatus =
      items.length < 5
        ? 'no_data'
        : budgetRemaining <= 0
          ? 'breached'
          : budgetRemainingPercent <= 20
            ? 'at_risk'
            : 'healthy';
    return {
      checks: items.length,
      healthy,
      availability,
      averageLatencyMs:
        latency.length === 0
          ? null
          : Math.round(latency.reduce((total, value) => total + value, 0) / latency.length),
      p95LatencyMs: percentile(latency, 0.95),
      incidents: incidentRows.filter(
        (incident) =>
          incident.resourceId ===
          monitorRows.find((row) => row.monitor.id === monitorId)?.monitor.resourceId,
      ).length,
      budgetTotal,
      budgetConsumed: failed,
      budgetRemaining,
      budgetRemainingPercent,
      burnRate,
      sloStatus,
    };
  }

  const monitorSummaries = monitorRows.map((row) => {
    const target = query.target ?? row.monitor.sloTargetBps / 100;
    return {
      id: row.monitor.id,
      name: row.resourceName,
      resourceType: row.resourceType,
      environment: row.environment,
      protocol: row.monitor.protocol,
      state: row.monitor.state,
      target,
      windowDays: row.monitor.sloWindowDays,
      metrics: metricsFor(row.monitor.id, target),
    };
  });
  const aggregateLatency = checks
    .map((check) => check.latencyMs)
    .filter((value): value is number => value !== null);
  const aggregateHealthy = checks.filter((check) => check.outcome === 'healthy').length;
  const aggregateAvailability =
    checks.length === 0 ? null : (aggregateHealthy / checks.length) * 100;
  const aggregateBudget = monitorSummaries.reduce(
    (total, monitor) => ({
      total: total.total + monitor.metrics.budgetTotal,
      consumed: total.consumed + monitor.metrics.budgetConsumed,
      remaining: total.remaining + monitor.metrics.budgetRemaining,
    }),
    { total: 0, consumed: 0, remaining: 0 },
  );
  const aggregateBudgetRemainingPercent =
    aggregateBudget.total === 0
      ? aggregateBudget.consumed === 0
        ? 100
        : 0
      : (aggregateBudget.remaining / aggregateBudget.total) * 100;
  const aggregateBurnRate =
    aggregateBudget.total === 0 ? null : aggregateBudget.consumed / aggregateBudget.total;
  const aggregateStatus =
    checks.length < 5
      ? 'no_data'
      : aggregateBudget.remaining <= 0
        ? 'breached'
        : aggregateBudgetRemainingPercent <= 20
          ? 'at_risk'
          : 'healthy';
  const configuredTargets = monitorRows.map((row) => row.monitor.sloTargetBps / 100);
  const averageTarget = configuredTargets.length
    ? configuredTargets.reduce((sum, target) => sum + target, 0) / configuredTargets.length
    : 99.9;
  return {
    windowDays: query.windowDays,
    windowStartedAt: since.toISOString(),
    target: query.target ?? averageTarget,
    aggregate: {
      monitors: monitorRows.length,
      checks: checks.length,
      healthy: aggregateHealthy,
      availability: aggregateAvailability,
      averageLatencyMs:
        aggregateLatency.length === 0
          ? null
          : Math.round(
              aggregateLatency.reduce((total, value) => total + value, 0) / aggregateLatency.length,
            ),
      p95LatencyMs: percentile(aggregateLatency, 0.95),
      incidents: incidentRows.length,
      onTarget: aggregateStatus !== 'breached',
      budgetTotal: aggregateBudget.total,
      budgetConsumed: aggregateBudget.consumed,
      budgetRemaining: aggregateBudget.remaining,
      budgetRemainingPercent: aggregateBudgetRemainingPercent,
      burnRate: aggregateBurnRate,
      sloStatus: aggregateStatus,
    },
    monitors: monitorSummaries,
  };
});

app.get('/v1/api-keys', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const items = await database.db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(inArray(apiKeys.userId, user.workspaceUserIds))
    .orderBy(desc(apiKeys.createdAt));
  return { apiKeys: items };
});

app.post('/v1/api-keys', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = apiKeyInputSchema.parse(request.body);
  const scopes = [...new Set(input.scopes)];
  const secret = `htk_${randomBytes(32).toString('base64url')}`;
  const created = (
    await database.db
      .insert(apiKeys)
      .values({
        userId: user.workspaceOwnerId,
        name: input.name,
        keyHash: sha256(secret),
        keyPrefix: secret.slice(0, 16),
        scopes,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        createdAt: apiKeys.createdAt,
      })
  )[0];
  if (!created) throw new Error('API key creation returned no record');
  return reply.code(201).send({ apiKey: created, secret });
});

app.delete('/v1/api-keys/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const revoked = (
    await database.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiKeys.id, id),
          inArray(apiKeys.userId, user.workspaceUserIds),
          isNull(apiKeys.revokedAt),
        ),
      )
      .returning({ id: apiKeys.id })
  )[0];
  if (!revoked) return reply.code(404).send({ error: 'api_key_not_found' });
  return reply.code(204).send();
});

app.patch('/v1/me/onboarding', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  onboardingInputSchema.parse(request.body);
  const onboardingCompletedAt = new Date();
  await database.db
    .update(users)
    .set({ onboardingCompletedAt, updatedAt: onboardingCompletedAt })
    .where(eq(users.id, user.id));
  return { onboardingCompletedAt };
});

app.get('/v1/scenarios', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const items = await database.db
    .select({
      id: scenarios.id,
      name: scenarios.name,
      definition: scenarios.definition,
      builtIn: scenarios.builtIn,
    })
    .from(scenarios)
    .where(or(eq(scenarios.builtIn, true), inArray(scenarios.userId, user.workspaceUserIds)))
    .orderBy(desc(scenarios.builtIn), scenarios.name);
  return { scenarios: items };
});

app.get('/v1/status/:token', async (request, reply) => {
  const { token } = request.params as { token: string };
  const page = (
    await database.db
      .select()
      .from(statusPages)
      .where(and(eq(statusPages.publicTokenHash, sha256(token)), eq(statusPages.enabled, true)))
      .limit(1)
  )[0];
  if (page) {
    const members = await database.db
      .select({ monitor: monitors, resource: integrationResources })
      .from(statusPageMonitors)
      .innerJoin(monitors, eq(statusPageMonitors.monitorId, monitors.id))
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(eq(statusPageMonitors.pageId, page.id))
      .orderBy(statusPageMonitors.position);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const publicMonitors = await Promise.all(
      members.map(async ({ monitor, resource }) => {
        const [checkRows, incidentRows] = await Promise.all([
          database.db
            .select({
              id: monitorChecks.id,
              outcome: monitorChecks.outcome,
              latencyMs: monitorChecks.latencyMs,
              startedAt: monitorChecks.startedAt,
              statusCode: monitorChecks.statusCode,
              errorCategory: monitorChecks.errorCategory,
              contractResult: monitorChecks.contractResult,
            })
            .from(monitorChecks)
            .where(
              and(eq(monitorChecks.monitorId, monitor.id), gte(monitorChecks.startedAt, since)),
            )
            .orderBy(asc(monitorChecks.startedAt))
            .limit(200),
          database.db
            .select({
              id: incidents.id,
              status: incidents.status,
              cause: incidents.cause,
              summary: incidents.summary,
              openedAt: incidents.openedAt,
              recoveredAt: incidents.recoveredAt,
            })
            .from(incidents)
            .where(eq(incidents.resourceId, resource.id))
            .orderBy(desc(incidents.openedAt))
            .limit(10),
        ]);
        return {
          id: monitor.id,
          name: resource.name,
          resourceType: resource.type,
          environment: resource.environment,
          protocol: monitor.protocol,
          displayHost: monitor.displayHost,
          state: monitor.state,
          lastCheckAt: monitor.lastCheckAt,
          metrics: monitorMetrics(checkRows),
          checks: checkRows.slice(-50).reverse(),
          incidents: incidentRows,
        };
      }),
    );
    const aggregateState = publicMonitors.some((monitor) => monitor.state === 'down')
      ? 'down'
      : publicMonitors.some((monitor) => monitor.state === 'degraded')
        ? 'degraded'
        : publicMonitors.some((monitor) => monitor.state === 'new')
          ? 'new'
          : 'healthy';
    return {
      page: {
        name: page.name,
        headline: page.headline,
        description: page.description,
        accentColor: page.accentColor,
        state: aggregateState,
        monitors: publicMonitors,
        generatedAt: new Date(),
      },
    };
  }
  const shared = (
    await database.db
      .select({ monitor: monitors, resource: integrationResources })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(
        and(
          eq(monitors.publicStatusTokenHash, sha256(token)),
          eq(monitors.publicStatusEnabled, true),
        ),
      )
      .limit(1)
  )[0];
  if (!shared) return reply.code(404).send({ error: 'status_page_not_found' });
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const [checkRows, incidentRows] = await Promise.all([
    database.db
      .select({
        id: monitorChecks.id,
        outcome: monitorChecks.outcome,
        latencyMs: monitorChecks.latencyMs,
        startedAt: monitorChecks.startedAt,
        statusCode: monitorChecks.statusCode,
        errorCategory: monitorChecks.errorCategory,
        contractResult: monitorChecks.contractResult,
      })
      .from(monitorChecks)
      .where(
        and(eq(monitorChecks.monitorId, shared.monitor.id), gte(monitorChecks.startedAt, since)),
      )
      .orderBy(asc(monitorChecks.startedAt))
      .limit(200),
    database.db
      .select({
        id: incidents.id,
        status: incidents.status,
        cause: incidents.cause,
        summary: incidents.summary,
        openedAt: incidents.openedAt,
        recoveredAt: incidents.recoveredAt,
      })
      .from(incidents)
      .where(eq(incidents.resourceId, shared.resource.id))
      .orderBy(desc(incidents.openedAt))
      .limit(10),
  ]);
  return {
    status: {
      name: shared.resource.name,
      resourceType: shared.resource.type,
      environment: shared.resource.environment,
      displayHost: shared.monitor.displayHost,
      state: shared.monitor.state,
      lastCheckAt: shared.monitor.lastCheckAt,
      metrics: monitorMetrics(checkRows),
      checks: checkRows.slice(-50).reverse(),
      incidents: incidentRows,
      generatedAt: new Date(),
    },
  };
});

async function assertOwnedMonitors(userIds: string[], monitorIds: string[]) {
  const uniqueIds = [...new Set(monitorIds)];
  const owned = await database.db
    .select({ id: monitors.id })
    .from(monitors)
    .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
    .where(and(inArray(integrationResources.userId, userIds), inArray(monitors.id, uniqueIds)));
  if (owned.length !== uniqueIds.length) {
    throw new NetworkPolicyError('blocked', 'A status page can only include your own monitors');
  }
  return uniqueIds;
}

app.get('/v1/status-pages', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const pages = await database.db
    .select()
    .from(statusPages)
    .where(inArray(statusPages.userId, user.workspaceUserIds))
    .orderBy(desc(statusPages.updatedAt));
  const memberships =
    pages.length === 0
      ? []
      : await database.db
          .select({ pageId: statusPageMonitors.pageId, monitorId: statusPageMonitors.monitorId })
          .from(statusPageMonitors)
          .where(
            inArray(
              statusPageMonitors.pageId,
              pages.map((page) => page.id),
            ),
          )
          .orderBy(statusPageMonitors.position);
  return {
    pages: pages.map((page) => {
      const token = decryptToken(page.encryptedToken);
      return {
        id: page.id,
        name: page.name,
        headline: page.headline,
        description: page.description,
        accentColor: page.accentColor,
        enabled: page.enabled,
        monitorIds: memberships
          .filter((membership) => membership.pageId === page.id)
          .map((membership) => membership.monitorId),
        shareUrl: token ? `${config.APP_ORIGIN.replace(/\/$/, '')}/status/${token}` : null,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
      };
    }),
  };
});

app.post('/v1/status-pages', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = statusPageInputSchema.parse(request.body);
  const monitorIds = await assertOwnedMonitors(user.workspaceUserIds, input.monitorIds);
  const existing = await database.db
    .select({ value: count() })
    .from(statusPages)
    .where(inArray(statusPages.userId, user.workspaceUserIds));
  if ((existing[0]?.value ?? 0) >= 10) {
    return reply.code(403).send({ error: 'status_page_limit_reached' });
  }
  const token = `hts_${nanoid(32)}`;
  const created = await database.db.transaction(async (tx) => {
    const page = (
      await tx
        .insert(statusPages)
        .values({
          userId: user.workspaceOwnerId,
          name: input.name,
          headline: input.headline,
          description: input.description,
          accentColor: input.accentColor.toLowerCase(),
          publicTokenHash: sha256(token),
          encryptedToken: encryptValue(token, config.PAYLOAD_ENCRYPTION_KEY),
          enabled: input.enabled,
        })
        .returning({ id: statusPages.id })
    )[0];
    if (!page) throw new Error('Status page creation returned no record');
    await tx
      .insert(statusPageMonitors)
      .values(monitorIds.map((monitorId, position) => ({ pageId: page.id, monitorId, position })));
    return page;
  });
  return reply.code(201).send({
    page: {
      ...created,
      shareUrl: `${config.APP_ORIGIN.replace(/\/$/, '')}/status/${token}`,
    },
  });
});

app.put('/v1/status-pages/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const input = updateStatusPageInputSchema.parse(request.body);
  const owned = (
    await database.db
      .select({ id: statusPages.id })
      .from(statusPages)
      .where(and(eq(statusPages.id, id), inArray(statusPages.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'status_page_not_found' });
  const monitorIds = input.monitorIds
    ? await assertOwnedMonitors(user.workspaceUserIds, input.monitorIds)
    : undefined;
  await database.db.transaction(async (tx) => {
    await tx
      .update(statusPages)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.headline !== undefined ? { headline: input.headline } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.accentColor !== undefined
          ? { accentColor: input.accentColor.toLowerCase() }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        updatedAt: new Date(),
      })
      .where(eq(statusPages.id, id));
    if (monitorIds) {
      await tx.delete(statusPageMonitors).where(eq(statusPageMonitors.pageId, id));
      await tx
        .insert(statusPageMonitors)
        .values(monitorIds.map((monitorId, position) => ({ pageId: id, monitorId, position })));
    }
  });
  return { updated: true };
});

app.post('/v1/status-pages/:id/rotate', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  deliveryActionInputSchema.parse(request.body);
  const { id } = request.params as { id: string };
  const token = `hts_${nanoid(32)}`;
  const updated = await database.db
    .update(statusPages)
    .set({
      publicTokenHash: sha256(token),
      encryptedToken: encryptValue(token, config.PAYLOAD_ENCRYPTION_KEY),
      enabled: true,
      updatedAt: new Date(),
    })
    .where(and(eq(statusPages.id, id), inArray(statusPages.userId, user.workspaceUserIds)))
    .returning({ id: statusPages.id });
  if (!updated[0]) return reply.code(404).send({ error: 'status_page_not_found' });
  return { shareUrl: `${config.APP_ORIGIN.replace(/\/$/, '')}/status/${token}` };
});

app.delete('/v1/status-pages/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const removed = await database.db
    .delete(statusPages)
    .where(and(eq(statusPages.id, id), inArray(statusPages.userId, user.workspaceUserIds)))
    .returning({ id: statusPages.id });
  if (!removed[0]) return reply.code(404).send({ error: 'status_page_not_found' });
  return reply.code(204).send();
});

app.post('/v1/scenarios', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = scenarioInputSchema.parse(request.body);
  const definition = { name: input.name, steps: input.steps, repeatLastStep: input.repeatLastStep };
  const created = await database.db
    .insert(scenarios)
    .values({ userId: user.workspaceOwnerId, name: input.name, definition })
    .returning({
      id: scenarios.id,
      name: scenarios.name,
      definition: scenarios.definition,
      builtIn: scenarios.builtIn,
    });
  return reply.code(201).send({ scenario: created[0] });
});

app.put('/v1/scenarios/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const input = scenarioInputSchema.parse(request.body);
  const definition = { name: input.name, steps: input.steps, repeatLastStep: input.repeatLastStep };
  const updated = await database.db
    .update(scenarios)
    .set({ name: input.name, definition, updatedAt: new Date() })
    .where(
      and(
        eq(scenarios.id, id),
        inArray(scenarios.userId, user.workspaceUserIds),
        eq(scenarios.builtIn, false),
      ),
    )
    .returning({
      id: scenarios.id,
      name: scenarios.name,
      definition: scenarios.definition,
      builtIn: scenarios.builtIn,
    });
  if (!updated[0]) return reply.code(404).send({ error: 'scenario_not_found' });
  return { scenario: updated[0] };
});

app.delete('/v1/scenarios/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const usage = await database.db
    .select({ value: count() })
    .from(endpoints)
    .where(and(inArray(endpoints.userId, user.workspaceUserIds), eq(endpoints.scenarioId, id)));
  if ((usage[0]?.value ?? 0) > 0) return reply.code(409).send({ error: 'scenario_in_use' });
  const removed = await database.db
    .delete(scenarios)
    .where(
      and(
        eq(scenarios.id, id),
        inArray(scenarios.userId, user.workspaceUserIds),
        eq(scenarios.builtIn, false),
      ),
    )
    .returning({ id: scenarios.id });
  if (!removed[0]) return reply.code(404).send({ error: 'scenario_not_found' });
  return reply.code(204).send();
});

app.get('/v1/monitors', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const rows = await database.db
    .select({ resource: integrationResources, monitor: monitors })
    .from(integrationResources)
    .innerJoin(monitors, eq(monitors.resourceId, integrationResources.id))
    .where(inArray(integrationResources.userId, user.workspaceUserIds))
    .orderBy(integrationResources.name);
  if (rows.length === 0) return { monitors: [] };

  const monitorIds = rows.map((row) => row.monitor.id);
  const resourceIds = rows.map((row) => row.resource.id);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const [checks, openIncidents] = await Promise.all([
    database.db
      .select({
        monitorId: monitorChecks.monitorId,
        outcome: monitorChecks.outcome,
        latencyMs: monitorChecks.latencyMs,
        startedAt: monitorChecks.startedAt,
        statusCode: monitorChecks.statusCode,
        errorCategory: monitorChecks.errorCategory,
      })
      .from(monitorChecks)
      .where(and(inArray(monitorChecks.monitorId, monitorIds), gte(monitorChecks.startedAt, since)))
      .orderBy(asc(monitorChecks.startedAt)),
    database.db
      .select()
      .from(incidents)
      .where(and(inArray(incidents.resourceId, resourceIds), eq(incidents.status, 'open'))),
  ]);

  return {
    monitors: rows.map(({ resource, monitor }) => {
      const metadata = resource.metadata as { displayUrl?: string };
      return {
        id: monitor.id,
        resourceId: resource.id,
        name: resource.name,
        resourceType: resource.type,
        environment: resource.environment,
        active: resource.active,
        displayUrl: metadata.displayUrl ?? monitor.displayHost,
        displayHost: monitor.displayHost,
        protocol: monitor.protocol,
        method: monitor.method,
        intervalSeconds: monitor.intervalSeconds,
        timeoutMs: monitor.timeoutMs,
        expectedMinStatus: monitor.expectedMinStatus,
        expectedMaxStatus: monitor.expectedMaxStatus,
        expectedText: monitor.expectedText,
        expectedJsonPath: monitor.expectedJsonPath,
        consecutiveFailuresToOpen: monitor.consecutiveFailuresToOpen,
        sloTarget: monitor.sloTargetBps / 100,
        sloWindowDays: monitor.sloWindowDays,
        allowPrivateNetworks: monitor.allowPrivateNetworks,
        allowedPrivateCidrs: monitor.allowedPrivateCidrs,
        hasAuthenticationHeaders: Boolean(monitor.encryptedHeaders),
        publicStatusEnabled: monitor.publicStatusEnabled,
        state: monitor.state,
        lastCheckAt: monitor.lastCheckAt,
        nextCheckAt: monitor.nextCheckAt,
        metrics: monitorMetrics(checks.filter((check) => check.monitorId === monitor.id)),
        score: calculateMonitorScore({
          availability: monitorMetrics(checks.filter((check) => check.monitorId === monitor.id))
            .availability24h,
          p95LatencyMs: monitorMetrics(checks.filter((check) => check.monitorId === monitor.id))
            .p95LatencyMs,
          timeoutMs: monitor.timeoutMs,
          contractFailures: checks.filter(
            (check) => check.monitorId === monitor.id && check.errorCategory === 'contract',
          ).length,
          networkFailures: checks.filter(
            (check) =>
              check.monitorId === monitor.id && ['dns', 'tls'].includes(check.errorCategory ?? ''),
          ).length,
          checks: checks.filter((check) => check.monitorId === monitor.id).length,
          openIncident: openIncidents.some((incident) => incident.resourceId === resource.id),
        }),
        incident: openIncidents.find((incident) => incident.resourceId === resource.id) ?? null,
      };
    }),
  };
});

app.post(
  '/v1/monitors',
  { config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const input = monitorInputSchema.parse(request.body);
    const existing = await database.db
      .select({ value: count() })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(
        and(
          inArray(integrationResources.userId, user.workspaceUserIds),
          sql`not coalesce(${integrationResources.metadata} ? 'demoRunId', false)`,
        ),
      );
    if (config.MONITORS_LIMIT > 0 && (existing[0]?.value ?? 0) >= config.MONITORS_LIMIT) {
      return reply.code(403).send({ error: 'monitor_limit_reached' });
    }
    const target = normalizeMonitorTarget(input.protocol, input.url);
    await validateMonitorTarget({ ...input, url: target });
    const presentation = monitorTargetPresentation(input.protocol, target);
    const created = await database.db.transaction(async (tx) => {
      const resource = (
        await tx
          .insert(integrationResources)
          .values({
            userId: user.workspaceOwnerId,
            type: input.resourceType,
            name: input.name,
            environment: input.environment,
            metadata: { displayUrl: presentation.displayUrl },
          })
          .returning({ id: integrationResources.id })
      )[0];
      if (!resource) throw new Error('Monitor resource creation returned no record');
      return (
        await tx
          .insert(monitors)
          .values({
            resourceId: resource.id,
            encryptedUrl: encryptValue(target, config.PAYLOAD_ENCRYPTION_KEY),
            displayHost: presentation.displayHost,
            protocol: input.protocol,
            method: input.method,
            encryptedHeaders: encryptedMonitorHeaders(input.headers),
            intervalSeconds: input.intervalSeconds,
            timeoutMs: input.timeoutMs,
            expectedMinStatus: input.expectedMinStatus,
            expectedMaxStatus: input.expectedMaxStatus,
            expectedText: input.expectedText,
            expectedJsonPath: input.expectedJsonPath,
            consecutiveFailuresToOpen: input.consecutiveFailuresToOpen,
            sloTargetBps: Math.round(input.sloTarget * 100),
            sloWindowDays: input.sloWindowDays,
            allowPrivateNetworks: input.allowPrivateNetworks,
            allowedPrivateCidrs: input.allowedPrivateCidrs,
          })
          .returning({ id: monitors.id, resourceId: monitors.resourceId, state: monitors.state })
      )[0];
    });
    return reply.code(201).send({ monitor: created });
  },
);

app.get('/v1/monitors/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ monitor: monitors, resource: integrationResources })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
  const [checks, incidentRows] = await Promise.all([
    database.db
      .select()
      .from(monitorChecks)
      .where(eq(monitorChecks.monitorId, id))
      .orderBy(desc(monitorChecks.startedAt))
      .limit(100),
    database.db
      .select()
      .from(incidents)
      .where(eq(incidents.resourceId, owned.resource.id))
      .orderBy(desc(incidents.openedAt))
      .limit(20),
  ]);
  return {
    monitor: {
      id: owned.monitor.id,
      resourceId: owned.resource.id,
      name: owned.resource.name,
      resourceType: owned.resource.type,
      environment: owned.resource.environment,
      active: owned.resource.active,
      displayUrl: (owned.resource.metadata as { displayUrl?: string }).displayUrl,
      displayHost: owned.monitor.displayHost,
      protocol: owned.monitor.protocol,
      method: owned.monitor.method,
      intervalSeconds: owned.monitor.intervalSeconds,
      timeoutMs: owned.monitor.timeoutMs,
      expectedMinStatus: owned.monitor.expectedMinStatus,
      expectedMaxStatus: owned.monitor.expectedMaxStatus,
      expectedText: owned.monitor.expectedText,
      expectedJsonPath: owned.monitor.expectedJsonPath,
      consecutiveFailuresToOpen: owned.monitor.consecutiveFailuresToOpen,
      sloTarget: owned.monitor.sloTargetBps / 100,
      sloWindowDays: owned.monitor.sloWindowDays,
      allowPrivateNetworks: owned.monitor.allowPrivateNetworks,
      allowedPrivateCidrs: owned.monitor.allowedPrivateCidrs,
      hasAuthenticationHeaders: Boolean(owned.monitor.encryptedHeaders),
      publicStatusEnabled: owned.monitor.publicStatusEnabled,
      state: owned.monitor.state,
      lastCheckAt: owned.monitor.lastCheckAt,
      nextCheckAt: owned.monitor.nextCheckAt,
    },
    checks,
    incidents: incidentRows,
  };
});

app.put('/v1/monitors/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const patch = updateMonitorInputSchema.parse(request.body);
  const owned = (
    await database.db
      .select({ monitor: monitors, resource: integrationResources })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
  const input = monitorInputSchema.parse({
    name: owned.resource.name,
    resourceType: owned.resource.type,
    protocol: owned.monitor.protocol,
    environment: owned.resource.environment,
    url: decryptValue(owned.monitor.encryptedUrl, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8'),
    method: owned.monitor.method,
    intervalSeconds: owned.monitor.intervalSeconds,
    timeoutMs: owned.monitor.timeoutMs,
    expectedMinStatus: owned.monitor.expectedMinStatus,
    expectedMaxStatus: owned.monitor.expectedMaxStatus,
    expectedText: owned.monitor.expectedText ?? undefined,
    expectedJsonPath: owned.monitor.expectedJsonPath ?? undefined,
    headers: decryptedMonitorHeaders(owned.monitor.encryptedHeaders),
    consecutiveFailuresToOpen: owned.monitor.consecutiveFailuresToOpen,
    sloTarget: owned.monitor.sloTargetBps / 100,
    sloWindowDays: owned.monitor.sloWindowDays,
    allowPrivateNetworks: owned.monitor.allowPrivateNetworks,
    allowedPrivateCidrs: owned.monitor.allowedPrivateCidrs,
    ...patch,
  });
  const target = normalizeMonitorTarget(input.protocol, input.url);
  await validateMonitorTarget({ ...input, url: target });
  const presentation = monitorTargetPresentation(input.protocol, target);
  await database.db.transaction(async (tx) => {
    await tx
      .update(integrationResources)
      .set({
        name: input.name,
        type: input.resourceType,
        environment: input.environment,
        metadata: { displayUrl: presentation.displayUrl },
        updatedAt: new Date(),
      })
      .where(eq(integrationResources.id, owned.resource.id));
    await tx
      .update(monitors)
      .set({
        encryptedUrl: encryptValue(target, config.PAYLOAD_ENCRYPTION_KEY),
        displayHost: presentation.displayHost,
        protocol: input.protocol,
        method: input.method,
        encryptedHeaders: encryptedMonitorHeaders(input.headers),
        intervalSeconds: input.intervalSeconds,
        timeoutMs: input.timeoutMs,
        expectedMinStatus: input.expectedMinStatus,
        expectedMaxStatus: input.expectedMaxStatus,
        expectedText: input.expectedText,
        expectedJsonPath: input.expectedJsonPath,
        consecutiveFailuresToOpen: input.consecutiveFailuresToOpen,
        sloTargetBps: Math.round(input.sloTarget * 100),
        sloWindowDays: input.sloWindowDays,
        allowPrivateNetworks: input.allowPrivateNetworks,
        allowedPrivateCidrs: input.allowedPrivateCidrs,
        nextCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, id));
  });
  return { monitor: { id, resourceId: owned.resource.id, state: owned.monitor.state } };
});

app.post('/v1/monitors/:id/status-page', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  deliveryActionInputSchema.parse(request.body);
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ id: monitors.id })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
  const token = `hts_${nanoid(32)}`;
  await database.db
    .update(monitors)
    .set({
      publicStatusTokenHash: sha256(token),
      publicStatusEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(monitors.id, id));
  return {
    shareUrl: `${config.APP_ORIGIN.replace(/\/$/, '')}/status/${token}`,
    rotated: true,
  };
});

app.delete('/v1/monitors/:id/status-page', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ id: monitors.id })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
  await database.db
    .update(monitors)
    .set({ publicStatusTokenHash: null, publicStatusEnabled: false, updatedAt: new Date() })
    .where(eq(monitors.id, id));
  return reply.code(204).send();
});

app.post(
  '/v1/monitors/:id/run',
  { config: { rateLimit: { max: 30, timeWindow: '1 hour' } } },
  async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const { id } = request.params as { id: string };
    const owned = (
      await database.db
        .select({
          id: monitors.id,
          intervalSeconds: monitors.intervalSeconds,
          state: monitors.state,
          active: integrationResources.active,
        })
        .from(monitors)
        .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
        .where(
          and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)),
        )
        .limit(1)
    )[0];
    if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
    if (!owned.active || owned.state === 'paused') {
      return reply.code(409).send({ error: 'monitor_paused' });
    }
    const queuedAt = Date.now();
    await database.db
      .update(monitors)
      .set({ nextCheckAt: new Date(queuedAt + owned.intervalSeconds * 1_000) })
      .where(eq(monitors.id, id));
    await monitorQueue.add(
      'manual-check',
      { monitorId: id },
      {
        jobId: `monitor-manual-${id}-${queuedAt}`,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    return reply.code(202).send({ queued: true });
  },
);

app.post('/v1/monitors/:id/pause', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ resourceId: integrationResources.id })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
  await database.db.transaction(async (tx) => {
    await tx
      .update(integrationResources)
      .set({ active: false })
      .where(eq(integrationResources.id, owned.resourceId));
    await tx
      .update(monitors)
      .set({ state: 'paused', updatedAt: new Date() })
      .where(eq(monitors.id, id));
  });
  return { state: 'paused' };
});

app.post('/v1/monitors/:id/resume', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ resourceId: integrationResources.id })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
  await database.db.transaction(async (tx) => {
    await tx
      .update(integrationResources)
      .set({ active: true })
      .where(eq(integrationResources.id, owned.resourceId));
    await tx
      .update(monitors)
      .set({ state: 'new', consecutiveFailures: 0, nextCheckAt: new Date(), updatedAt: new Date() })
      .where(eq(monitors.id, id));
  });
  return { state: 'new' };
});

app.delete('/v1/monitors/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ resourceId: integrationResources.id })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(and(eq(monitors.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'monitor_not_found' });
  await database.db
    .delete(integrationResources)
    .where(eq(integrationResources.id, owned.resourceId));
  return reply.code(204).send();
});

app.get('/v1/incidents', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const rows = await database.db
    .select({
      incident: incidents,
      resourceName: integrationResources.name,
      resourceType: integrationResources.type,
    })
    .from(incidents)
    .innerJoin(integrationResources, eq(incidents.resourceId, integrationResources.id))
    .where(inArray(integrationResources.userId, user.workspaceUserIds))
    .orderBy(desc(incidents.openedAt))
    .limit(100);
  return {
    incidents: rows.map((row) => ({
      ...row.incident,
      resourceName: row.resourceName,
      resourceType: row.resourceType,
    })),
  };
});

app.patch('/v1/incidents/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const patch = incidentTriageInputSchema.parse(request.body);
  const owned = (
    await database.db
      .select({ incident: incidents, resourceName: integrationResources.name })
      .from(incidents)
      .innerJoin(integrationResources, eq(incidents.resourceId, integrationResources.id))
      .where(and(eq(incidents.id, id), inArray(integrationResources.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'incident_not_found' });

  const values: Partial<typeof incidents.$inferInsert> = { updatedAt: new Date() };
  if (patch.assigneeUserId !== undefined) {
    if (patch.assigneeUserId !== null) {
      const assignee = await database.db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, user.workspaceId),
            eq(workspaceMembers.userId, patch.assigneeUserId),
          ),
        )
        .limit(1);
      if (!assignee[0]) return reply.code(400).send({ error: 'incident_assignee_not_member' });
    }
    values.assigneeUserId = patch.assigneeUserId;
  }
  if (patch.acknowledged !== undefined) {
    values.acknowledgedAt = patch.acknowledged ? new Date() : null;
    values.acknowledgedByUserId = patch.acknowledged ? user.id : null;
  }
  if (patch.note !== undefined) values.resolutionNote = patch.note;

  const [updated] = await database.db
    .update(incidents)
    .set(values)
    .where(eq(incidents.id, id))
    .returning();
  return {
    incident: {
      ...updated,
      resourceName: owned.resourceName,
    },
  };
});

app.get('/v1/operations', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1_000);
  const [incidentRows, deadLetterRows, recoveryRows, alertRows] = await Promise.all([
    database.db
      .select({
        incident: incidents,
        resourceName: integrationResources.name,
        resourceType: integrationResources.type,
        environment: integrationResources.environment,
      })
      .from(incidents)
      .innerJoin(integrationResources, eq(incidents.resourceId, integrationResources.id))
      .where(inArray(integrationResources.userId, user.workspaceUserIds))
      .orderBy(desc(incidents.openedAt))
      .limit(100),
    database.db
      .select({
        delivery: destinationDeliveries,
        eventId: events.id,
        correlationKey: events.correlationKey,
        endpointId: endpoints.id,
        resourceName: integrationResources.name,
        environment: integrationResources.environment,
      })
      .from(destinationDeliveries)
      .innerJoin(events, eq(destinationDeliveries.eventId, events.id))
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .innerJoin(
        integrationResources,
        eq(destinationDeliveries.resourceId, integrationResources.id),
      )
      .where(
        and(
          inArray(integrationResources.userId, user.workspaceUserIds),
          eq(destinationDeliveries.state, 'dead_letter'),
        ),
      )
      .orderBy(desc(destinationDeliveries.createdAt))
      .limit(100),
    database.db
      .select({ id: destinationDeliveries.id })
      .from(destinationDeliveries)
      .innerJoin(
        integrationResources,
        eq(destinationDeliveries.resourceId, integrationResources.id),
      )
      .where(
        and(
          inArray(integrationResources.userId, user.workspaceUserIds),
          eq(destinationDeliveries.state, 'succeeded'),
          inArray(destinationDeliveries.kind, ['retry', 'replay']),
          gte(destinationDeliveries.completedAt, since24h),
        ),
      ),
    database.db
      .select({
        delivery: alertDeliveries,
        resourceName: integrationResources.name,
        incidentEvent: incidents.status,
      })
      .from(alertDeliveries)
      .innerJoin(alertChannels, eq(alertDeliveries.channelId, alertChannels.id))
      .innerJoin(incidents, eq(alertDeliveries.incidentId, incidents.id))
      .innerJoin(integrationResources, eq(incidents.resourceId, integrationResources.id))
      .where(eq(alertChannels.userId, user.id))
      .orderBy(desc(alertDeliveries.createdAt))
      .limit(50),
  ]);

  const deadLetterEventIds = [...new Set(deadLetterRows.map((row) => row.eventId))];
  const followUps =
    deadLetterEventIds.length === 0
      ? []
      : await database.db
          .select({
            id: destinationDeliveries.id,
            eventId: destinationDeliveries.eventId,
            sequence: destinationDeliveries.sequence,
            state: destinationDeliveries.state,
          })
          .from(destinationDeliveries)
          .where(inArray(destinationDeliveries.eventId, deadLetterEventIds));

  const deadLetters = deadLetterRows.map((row) => {
    const children = followUps.filter(
      (delivery) => delivery.eventId === row.eventId && delivery.sequence > row.delivery.sequence,
    );
    const recovery = children.find((delivery) => delivery.state === 'succeeded') ?? null;
    const pending = children.find((delivery) =>
      ['queued', 'delivering', 'retrying'].includes(delivery.state),
    );
    return {
      ...row.delivery,
      eventId: row.eventId,
      correlationKey: row.correlationKey,
      endpointId: row.endpointId,
      resourceName: row.resourceName,
      environment: row.environment,
      resolved: Boolean(recovery),
      recoveryDeliveryId: recovery?.id ?? null,
      recoveryPending: Boolean(pending),
    };
  });

  const incidentItems = incidentRows.map((row) => ({
    ...row.incident,
    resourceName: row.resourceName,
    resourceType: row.resourceType,
    environment: row.environment,
  }));
  return {
    summary: {
      openIncidents: incidentItems.filter((incident) => incident.status === 'open').length,
      unacknowledgedOpenIncidents: incidentItems.filter(
        (incident) => incident.status === 'open' && !incident.acknowledgedAt,
      ).length,
      recovered24h: incidentItems.filter(
        (incident) =>
          incident.recoveredAt && new Date(incident.recoveredAt).getTime() >= since24h.getTime(),
      ).length,
      unresolvedDeadLetters: deadLetters.filter((delivery) => !delivery.resolved).length,
      protectedRecoveries24h: recoveryRows.length,
    },
    incidents: incidentItems,
    deadLetters,
    alerts: alertRows.map((row) => ({
      ...row.delivery,
      resourceName: row.resourceName,
      incidentStatus: row.incidentEvent,
    })),
  };
});

app.get('/v1/integrations', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const routes = await database.db
    .select({ resource: integrationResources, endpoint: endpoints })
    .from(integrationResources)
    .innerJoin(endpoints, eq(endpoints.resourceId, integrationResources.id))
    .where(
      and(
        inArray(integrationResources.userId, user.workspaceUserIds),
        eq(integrationResources.type, 'webhook_route'),
      ),
    )
    .orderBy(integrationResources.name);

  const integrations = await Promise.all(
    routes.map(async ({ resource, endpoint }) => {
      const [deliveryHistory, attemptHistory, openRows, reportHistory] = await Promise.all([
        database.db
          .select()
          .from(destinationDeliveries)
          .where(eq(destinationDeliveries.resourceId, resource.id))
          .orderBy(desc(destinationDeliveries.startedAt))
          .limit(100),
        database.db
          .select({
            responseStatus: attempts.responseStatus,
            signatureStatus: attempts.signatureStatus,
            contractResult: attempts.contractResult,
          })
          .from(attempts)
          .innerJoin(events, eq(attempts.eventId, events.id))
          .where(eq(events.endpointId, endpoint.id))
          .orderBy(desc(attempts.receivedAt))
          .limit(100),
        database.db
          .select()
          .from(incidents)
          .where(and(eq(incidents.resourceId, resource.id), eq(incidents.status, 'open')))
          .limit(1),
        database.db
          .select({ status: reports.status })
          .from(reports)
          .innerJoin(events, eq(reports.eventId, events.id))
          .where(eq(events.endpointId, endpoint.id))
          .orderBy(desc(reports.completedAt))
          .limit(100),
      ]);
      const latest = deliveryHistory[0] ?? null;
      const openIncident = openRows[0] ?? null;
      return {
        id: resource.id,
        endpointId: endpoint.id,
        name: resource.name,
        resourceType: resource.type,
        environment: resource.environment,
        active: resource.active,
        mode: endpoint.mode,
        destinationHost: endpoint.displayDestinationHost,
        state: !endpoint.active
          ? 'paused'
          : !latest
            ? 'new'
            : latest.state === 'succeeded'
              ? 'healthy'
              : ['queued', 'delivering', 'retrying'].includes(latest.state)
                ? 'degraded'
                : 'down',
        latestDelivery: latest,
        incident: openIncident,
        score: calculateWebhookScore({
          deliveries: deliveryHistory.length,
          failedDeliveries: deliveryHistory.filter((delivery) =>
            ['failed', 'retrying', 'dead_letter'].includes(delivery.state),
          ).length,
          retries: deliveryHistory.filter((delivery) => delivery.kind === 'retry').length,
          deadLetters: deliveryHistory.filter((delivery) => delivery.state === 'dead_letter')
            .length,
          invalidSignatures: attemptHistory.filter((attempt) =>
            ['invalid', 'missing', 'stale'].includes(attempt.signatureStatus),
          ).length,
          contractFailures: attemptHistory.filter((attempt) => {
            const result = attempt.contractResult as { configured?: boolean; passed?: boolean };
            return result.configured === true && result.passed === false;
          }).length,
          inboundAttempts: attemptHistory.length,
          openIncident: Boolean(openIncident),
        }),
        readiness: calculateIntegrationReadiness({
          active: endpoint.active,
          externalAccess,
          contractConfigured: Boolean(endpoint.encryptedContract),
          signatureConfigured: Boolean(endpoint.encryptedSignatureSecret),
          destinationConfigured: Boolean(endpoint.encryptedDestinationUrl),
          protectMode: endpoint.mode === 'protect',
          attemptsObserved: attemptHistory.length,
          recoveryDemonstrated:
            deliveryHistory.some(
              (delivery) => delivery.state === 'succeeded' && delivery.sequence > 1,
            ) ||
            (attemptHistory.length > 1 &&
              Boolean(
                attemptHistory[0] &&
                attemptHistory[0].responseStatus >= 200 &&
                attemptHistory[0].responseStatus < 300,
              )),
          evidenceGenerated: reportHistory.some((report) => report.status === 'passed'),
          openIncident: Boolean(openIncident),
        }),
      };
    }),
  );
  return { integrations };
});

app.get('/v1/alert-channel', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const channel = (
    await database.db
      .select()
      .from(alertChannels)
      .where(eq(alertChannels.userId, user.workspaceOwnerId))
      .limit(1)
  )[0];
  if (!channel) return { channel: null };
  const recent = await database.db
    .select()
    .from(alertDeliveries)
    .where(eq(alertDeliveries.channelId, channel.id))
    .orderBy(desc(alertDeliveries.createdAt))
    .limit(20);
  return {
    channel: {
      id: channel.id,
      displayHost: channel.displayHost,
      provider: channel.provider,
      scopes: channel.scopes,
      events: channel.events,
      active: channel.active,
      allowPrivateNetworks: channel.allowPrivateNetworks,
      allowedPrivateCidrs: channel.allowedPrivateCidrs,
      hasHeaders: Boolean(channel.encryptedHeaders),
      recent,
    },
  };
});

app.put('/v1/alert-channel', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = alertChannelInputSchema.parse(request.body);
  const existing = (
    await database.db
      .select()
      .from(alertChannels)
      .where(eq(alertChannels.userId, user.workspaceOwnerId))
      .limit(1)
  )[0];
  if (!input.url && !existing) {
    return reply.code(400).send({ error: 'alert_channel_url_required' });
  }
  const url =
    input.url ??
    decryptValue(existing!.encryptedUrl, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8');
  await validateTarget(url, monitorNetworkOptions(input));
  const value = {
    userId: user.workspaceOwnerId,
    encryptedUrl: input.url
      ? encryptValue(url, config.PAYLOAD_ENCRYPTION_KEY)
      : existing!.encryptedUrl,
    displayHost: new URL(url).host,
    encryptedHeaders:
      input.provider === 'discord'
        ? null
        : input.headers === undefined
          ? (existing?.encryptedHeaders ?? null)
          : encryptHeaders(input.headers),
    provider: input.provider,
    scopes: input.scopes,
    events: input.events,
    active: input.active,
    allowPrivateNetworks: input.allowPrivateNetworks,
    allowedPrivateCidrs: input.allowedPrivateCidrs,
    updatedAt: new Date(),
  };
  const channel = (
    await database.db
      .insert(alertChannels)
      .values(value)
      .onConflictDoUpdate({ target: alertChannels.userId, set: value })
      .returning({
        id: alertChannels.id,
        displayHost: alertChannels.displayHost,
        provider: alertChannels.provider,
        scopes: alertChannels.scopes,
        events: alertChannels.events,
        active: alertChannels.active,
      })
  )[0];
  return { channel };
});

app.post('/v1/alert-channel/test', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const channel = (
    await database.db
      .select()
      .from(alertChannels)
      .where(eq(alertChannels.userId, user.workspaceOwnerId))
      .limit(1)
  )[0];
  if (!channel) return reply.code(404).send({ error: 'alert_channel_not_configured' });
  const url = decryptValue(channel.encryptedUrl, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8');
  const provider = channel.provider === 'discord' ? 'discord' : 'generic';
  const body = Buffer.from(JSON.stringify(buildTestAlertPayload(provider)));
  const response = await safeRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...decryptedMonitorHeaders(channel.encryptedHeaders),
    },
    body,
    timeoutMs: 10_000,
    maxResponseBytes: 16_384,
    ...monitorNetworkOptions({
      allowPrivateNetworks: channel.allowPrivateNetworks,
      allowedPrivateCidrs: channel.allowedPrivateCidrs as string[],
    }),
  });
  return {
    provider,
    delivered: response.statusCode >= 200 && response.statusCode < 300,
    statusCode: response.statusCode,
    latencyMs: response.latencyMs,
  };
});

app.delete('/v1/alert-channel', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  await database.db.delete(alertChannels).where(eq(alertChannels.userId, user.workspaceOwnerId));
  return reply.code(204).send();
});

app.post('/v1/preflight/destination', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = destinationPreflightInputSchema.parse(request.body);
  const checks: Array<{
    id: 'network_policy' | 'dns' | 'tls_http' | 'contract' | 'signature';
    status: 'passed' | 'warning' | 'failed';
    detail: string;
  }> = [];

  try {
    const target = await validateTarget(
      input.url,
      monitorNetworkOptions({ allowPrivateNetworks: false, allowedPrivateCidrs: [] }),
    );
    checks.push({
      id: 'network_policy',
      status: 'passed',
      detail: 'Destination is allowed by the outbound network policy.',
    });
    checks.push({
      id: 'dns',
      status: 'passed',
      detail: `${target.hostname} resolved to ${target.addresses.length} public address${target.addresses.length === 1 ? '' : 'es'}.`,
    });
  } catch (error) {
    if (
      error instanceof NetworkPolicyError &&
      (error.category === 'blocked' || error.category === 'invalid_url')
    ) {
      throw error;
    }
    const category = error instanceof NetworkPolicyError ? error.category : 'connect';
    return {
      reachable: false,
      ready: false,
      statusCode: null,
      latencyMs: null,
      checks: [
        {
          id: 'dns',
          status: 'failed',
          detail: `Destination could not be resolved or reached (${category}).`,
        },
        {
          id: 'contract',
          status: input.contractConfigured ? 'passed' : 'warning',
          detail: input.contractConfigured
            ? 'An inbound contract will validate provider requests.'
            : 'No inbound contract is configured yet.',
        },
        {
          id: 'signature',
          status: input.signatureConfigured ? 'passed' : 'warning',
          detail: input.signatureConfigured
            ? 'Provider signature verification is configured.'
            : 'Provider signature verification is not configured.',
        },
      ],
    };
  }

  let statusCode: number | null = null;
  let latencyMs: number | null = null;
  try {
    const response = await safeRequest(input.url, {
      method: 'HEAD',
      timeoutMs: input.timeoutMs,
      maxResponseBytes: 0,
      ...monitorNetworkOptions({ allowPrivateNetworks: false, allowedPrivateCidrs: [] }),
    });
    statusCode = response.statusCode;
    latencyMs = response.latencyMs;
    checks.push({
      id: 'tls_http',
      status: 'passed',
      detail: `Destination answered HTTP ${response.statusCode} in ${response.latencyMs} ms. Any HTTP response proves reachability; no webhook payload was sent.`,
    });
  } catch (error) {
    const category = error instanceof NetworkPolicyError ? error.category : 'connect';
    checks.push({
      id: 'tls_http',
      status: category === 'redirect' ? 'warning' : 'failed',
      detail:
        category === 'redirect'
          ? 'Destination answered with a redirect. Use the final HTTPS webhook URL.'
          : `Destination did not answer the safe HEAD probe (${category}).`,
    });
  }

  checks.push({
    id: 'contract',
    status: input.contractConfigured ? 'passed' : 'warning',
    detail: input.contractConfigured
      ? 'An inbound contract will validate provider requests.'
      : 'No inbound contract is configured yet.',
  });
  const signatureRecommended = input.provider !== 'generic';
  checks.push({
    id: 'signature',
    status: input.signatureConfigured ? 'passed' : signatureRecommended ? 'warning' : 'passed',
    detail: input.signatureConfigured
      ? 'Provider signature verification is configured.'
      : signatureRecommended
        ? `${input.provider} traffic is not protected by signature verification yet.`
        : 'Signature verification is optional for this generic integration.',
  });

  const reachable = checks.some(
    (check) => check.id === 'tls_http' && (check.status === 'passed' || check.status === 'warning'),
  );
  return {
    reachable,
    ready: reachable && input.contractConfigured,
    statusCode,
    latencyMs,
    checks,
  };
});

app.get('/v1/endpoints', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const items = await database.db
    .select({
      id: endpoints.id,
      resourceId: endpoints.resourceId,
      name: endpoints.name,
      tokenPrefix: endpoints.publicTokenPrefix,
      encryptedToken: endpoints.encryptedToken,
      active: endpoints.active,
      mode: endpoints.mode,
      environment: endpoints.environment,
      destinationHost: endpoints.displayDestinationHost,
      destinationConfigured: sql<boolean>`${endpoints.encryptedDestinationUrl} is not null`,
      destinationTimeoutMs: endpoints.destinationTimeoutMs,
      retryMaxAttempts: endpoints.retryMaxAttempts,
      retryBaseDelayMs: endpoints.retryBaseDelayMs,
      retryMaxDelayMs: endpoints.retryMaxDelayMs,
      deliveryPaused: endpoints.deliveryPaused,
      deliveryStrategy: endpoints.deliveryStrategy,
      idempotencyScope: endpoints.idempotencyScope,
      encryptedDeliveryPolicy: endpoints.encryptedDeliveryPolicy,
      contractConfigured: sql<boolean>`${endpoints.encryptedContract} is not null`,
      signatureProvider: endpoints.signatureProvider,
      signatureConfigured: sql<boolean>`${endpoints.encryptedSignatureSecret} is not null`,
      signatureToleranceSeconds: endpoints.signatureToleranceSeconds,
      destinationExpectedMinStatus: endpoints.destinationExpectedMinStatus,
      destinationExpectedMaxStatus: endpoints.destinationExpectedMaxStatus,
      allowPrivateNetworks: endpoints.allowPrivateNetworks,
      allowedPrivateCidrs: endpoints.allowedPrivateCidrs,
      productionConfirmedAt: endpoints.productionConfirmedAt,
      scenarioId: endpoints.scenarioId,
      scenarioName: scenarios.name,
      createdAt: endpoints.createdAt,
      expiresAt: endpoints.expiresAt,
      resourceMetadata: integrationResources.metadata,
    })
    .from(endpoints)
    .leftJoin(scenarios, eq(endpoints.scenarioId, scenarios.id))
    .leftJoin(integrationResources, eq(endpoints.resourceId, integrationResources.id))
    .where(inArray(endpoints.userId, user.workspaceUserIds))
    .orderBy(desc(endpoints.createdAt));

  return {
    endpoints: items.map(
      ({ encryptedToken, resourceMetadata, encryptedDeliveryPolicy, ...item }) => {
        const token = decryptToken(encryptedToken);
        const metadata = resourceMetadata as { demoRunId?: unknown; provider?: unknown } | null;
        const provider = [
          'generic',
          'stripe',
          'github',
          'shopify',
          'slack',
          'gitlab',
          'linear',
          'hubspot',
        ].includes(String(metadata?.provider))
          ? String(metadata?.provider)
          : item.signatureProvider === 'github' || item.signatureProvider === 'stripe'
            ? item.signatureProvider
            : 'generic';
        return {
          ...item,
          ...deliveryPolicySummary(decryptDeliveryPolicy(encryptedDeliveryPolicy), {
            host: item.destinationHost,
          }),
          demoOwned: typeof metadata?.demoRunId === 'string',
          provider,
          ingestUrl: token ? `${config.INGEST_ORIGIN}/i/${token}` : null,
        };
      },
    ),
    limits: {
      endpoints: config.ENDPOINTS_LIMIT,
      endpointUsage: items.filter((item) => {
        const metadata = item.resourceMetadata as { demoRunId?: unknown } | null;
        return typeof metadata?.demoRunId !== 'string';
      }).length,
      dailyEvents: config.DAILY_EVENTS_LIMIT,
    },
  };
});

type SyntheticEventResult =
  | {
      accepted: boolean;
      eventId: string | null;
      correlationKey: string;
      mode: string;
      statusCode: number;
      latencyMs: number;
      destinationTriggered: true;
    }
  | {
      error:
        | 'endpoint_not_found'
        | 'endpoint_inactive'
        | 'live_route_required'
        | 'ingest_token_unavailable';
      status: 404 | 409;
    };

async function triggerSyntheticEvent(userIds: string[], id: string): Promise<SyntheticEventResult> {
  const owned = (
    await database.db
      .select({ endpoint: endpoints, metadata: integrationResources.metadata })
      .from(endpoints)
      .leftJoin(integrationResources, eq(endpoints.resourceId, integrationResources.id))
      .where(and(eq(endpoints.id, id), inArray(endpoints.userId, userIds)))
      .limit(1)
  )[0];
  if (!owned) return { error: 'endpoint_not_found', status: 404 };
  if (!owned.endpoint.active) return { error: 'endpoint_inactive', status: 409 };
  if (owned.endpoint.mode === 'trial' || !owned.endpoint.encryptedDestinationUrl) {
    return { error: 'live_route_required', status: 409 };
  }

  const token = decryptToken(owned.endpoint.encryptedToken);
  if (!token) return { error: 'ingest_token_unavailable', status: 409 };
  const metadata = owned.metadata as { provider?: unknown } | null;
  const provider = [
    'generic',
    'stripe',
    'github',
    'shopify',
    'slack',
    'gitlab',
    'linear',
    'hubspot',
  ].includes(String(metadata?.provider))
    ? String(metadata?.provider)
    : owned.endpoint.signatureProvider === 'github' || owned.endpoint.signatureProvider === 'stripe'
      ? owned.endpoint.signatureProvider
      : 'generic';
  const eventId = `evt_ht_${nanoid(20)}`;
  const payload: Record<string, unknown> = {
    id: eventId,
    type: 'hooktrials.test',
    source: 'hooktrials-webhook-hub',
    synthetic: true,
    sentAt: new Date().toISOString(),
    data: {
      routeId: owned.endpoint.id,
      routeName: owned.endpoint.name,
      environment: owned.endpoint.environment,
    },
  };
  let method: SyntheticMethod = 'POST';
  let contract: SyntheticContract | undefined;
  if (owned.endpoint.encryptedContract) {
    contract = JSON.parse(
      decryptValue(owned.endpoint.encryptedContract, config.PAYLOAD_ENCRYPTION_KEY).toString(
        'utf8',
      ),
    ) as SyntheticContract;
    method = contract.method ?? method;
    for (const [path, expected] of Object.entries(contract.jsonPaths ?? {})) {
      setSyntheticJsonPath(payload, path, expected);
    }
  }
  const body = Buffer.from(JSON.stringify(payload));
  const signatureSecret = decryptToken(owned.endpoint.encryptedSignatureSecret);
  const headers = syntheticProviderHeaders({
    provider,
    eventId,
    body,
    signatureProvider: owned.endpoint.signatureProvider,
    signatureSecret,
  });
  const currentHeaderNames = new Set(Object.keys(headers).map((name) => name.toLowerCase()));
  const unsafeSyntheticHeaders = new Set([
    'authorization',
    'cookie',
    'host',
    'proxy-authorization',
    'transfer-encoding',
  ]);
  for (const [name, expected] of Object.entries(contract?.requiredHeaders ?? {})) {
    const normalized = name.toLowerCase();
    if (
      expected === '' &&
      !currentHeaderNames.has(normalized) &&
      !unsafeSyntheticHeaders.has(normalized)
    ) {
      headers[name] = 'synthetic-test';
      currentHeaderNames.add(normalized);
    }
  }
  const target = syntheticIngestTarget(token);
  const response = await safeRequest(target.url, {
    method,
    headers,
    body: method === 'HEAD' ? undefined : body,
    timeoutMs: Math.min(owned.endpoint.destinationTimeoutMs + 2_000, 30_000),
    maxResponseBytes: 65_536,
    ...target.network,
  });
  const recorded = (
    await database.db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.endpointId, owned.endpoint.id), eq(events.correlationKey, eventId)))
      .limit(1)
  )[0];

  return {
    accepted: Boolean(recorded),
    eventId: recorded?.id ?? null,
    correlationKey: eventId,
    mode: owned.endpoint.mode,
    statusCode: response.statusCode,
    latencyMs: response.latencyMs,
    destinationTriggered: true,
  };
}

function sendSyntheticEventResult(reply: FastifyReply, result: SyntheticEventResult) {
  if ('error' in result) return reply.code(result.status).send({ error: result.error });
  return result;
}

app.post('/v1/endpoints/:id/test-event', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  syntheticEventInputSchema.parse(request.body);
  const { id } = request.params as { id: string };
  return sendSyntheticEventResult(reply, await triggerSyntheticEvent(user.workspaceUserIds, id));
});

app.post('/v1/automation/endpoints/:id/test-event', async (request, reply) => {
  const user = await requireApiKey(request, reply, 'write');
  if (!user) return;
  syntheticEventInputSchema.parse(request.body);
  const { id } = request.params as { id: string };
  return sendSyntheticEventResult(reply, await triggerSyntheticEvent([user.id], id));
});

app.get('/v1/demo/active', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const resources = await database.db
    .select({ metadata: integrationResources.metadata, createdAt: integrationResources.createdAt })
    .from(integrationResources)
    .where(
      and(
        inArray(integrationResources.userId, user.workspaceUserIds),
        sql`${integrationResources.metadata} ? 'demoRunId'`,
      ),
    )
    .orderBy(desc(integrationResources.createdAt));
  const run = resources.find((resource) => {
    const metadata = resource.metadata as { demoRunId?: unknown };
    return typeof metadata.demoRunId === 'string';
  });
  if (!run) return { demo: null };
  const runId = (run.metadata as { demoRunId: string }).demoRunId;
  const runIds = new Set(
    resources.flatMap((resource) => {
      const value = (resource.metadata as { demoRunId?: unknown }).demoRunId;
      return typeof value === 'string' ? [value] : [];
    }),
  );
  return {
    demo: {
      runId,
      createdAt: run.createdAt,
      resourceCount: resources.length,
      runCount: runIds.size,
    },
  };
});

app.post('/v1/demo/setup', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const demoLock = await acquireDemoMutationLock(redis, user.workspaceOwnerId);
  if (!demoLock) {
    return reply.code(409).send({ error: 'demo_operation_in_progress' });
  }
  try {
    const userId = user.workspaceOwnerId;
    const activeDemo = (
      await database.db
        .select({ metadata: integrationResources.metadata })
        .from(integrationResources)
        .where(
          and(
            inArray(integrationResources.userId, user.workspaceUserIds),
            sql`${integrationResources.metadata} ? 'demoRunId'`,
          ),
        )
        .limit(1)
    )[0];
    if (activeDemo) {
      const metadata = activeDemo.metadata as { demoRunId?: unknown };
      return reply.code(409).send({
        error: 'demo_run_active',
        runId: typeof metadata.demoRunId === 'string' ? metadata.demoRunId : undefined,
      });
    }

    const runId = nanoid(16);
    const trialToken = `ht_${nanoid(32)}`;
    const targetToken = `ht_${nanoid(32)}`;
    const observeToken = `ht_${nanoid(32)}`;
    const protectToken = `ht_${nanoid(32)}`;
    const deadLetterToken = `ht_${nanoid(32)}`;
    const githubSecret = `demo_${nanoid(32)}`;
    const trialIngestUrl = `${config.INGEST_ORIGIN}/i/${trialToken}`;
    const targetIngestUrl = `${config.INGEST_ORIGIN}/i/${targetToken}`;
    const observeIngestUrl = `${config.INGEST_ORIGIN}/i/${observeToken}`;
    const protectIngestUrl = `${config.INGEST_ORIGIN}/i/${protectToken}`;
    const deadLetterIngestUrl = `${config.INGEST_ORIGIN}/i/${deadLetterToken}`;
    const targetWorkerUrl =
      config.DEPLOYMENT_MODE === 'selfhost'
        ? `http://ingestor:3002/i/${targetToken}`
        : targetIngestUrl;
    const apiHealthUrl = `${config.API_ORIGIN.replace(/\/$/, '')}/healthz`;
    const apiHealthWorkerUrl =
      config.DEPLOYMENT_MODE === 'selfhost' ? 'http://api:3001/healthz' : apiHealthUrl;
    const applicationWorkerUrl =
      config.DEPLOYMENT_MODE === 'selfhost' ? 'http://web:8080/' : config.APP_ORIGIN;
    const privateNetwork = config.DEPLOYMENT_MODE === 'selfhost';
    const privateCidrs = privateNetwork ? ['172.16.0.0/12'] : [];
    const existingAlertChannel = (
      await database.db
        .select({ id: alertChannels.id })
        .from(alertChannels)
        .where(and(eq(alertChannels.userId, userId), eq(alertChannels.active, true)))
        .limit(1)
    )[0];

    const created = await database.db.transaction(async (tx) => {
      const customScenario = (
        await tx
          .insert(scenarios)
          .values({
            userId,
            name: 'Demo · Cascading provider outage',
            definition: {
              name: 'Demo · Cascading provider outage',
              repeatLastStep: true,
              steps: [
                { statusCode: 500, delayMs: 0, headers: {} },
                { statusCode: 503, delayMs: 250, headers: {} },
                { statusCode: 429, delayMs: 0, headers: { 'retry-after': '2' } },
                { statusCode: 200, delayMs: 0, headers: {} },
              ],
            },
          })
          .returning({ id: scenarios.id, name: scenarios.name })
      )[0];
      if (!customScenario) throw new Error('Demo scenario creation returned no record');

      async function createDemoEndpoint(input: {
        kind: 'trial' | 'target' | 'observe' | 'protect' | 'dead-letter';
        name: string;
        token: string;
        scenarioId: string;
        mode?: 'trial' | 'observe' | 'protect';
        destinationUrl?: string;
        provider?: 'generic' | 'github';
        signatureSecret?: string;
        retryMaxAttempts?: number;
      }) {
        const resource = (
          await tx
            .insert(integrationResources)
            .values({
              userId,
              type: 'webhook_route',
              name: input.name,
              environment: 'test',
              metadata: {
                demoRunId: runId,
                demoKind: input.kind,
                provider: input.provider ?? 'generic',
              },
            })
            .returning({ id: integrationResources.id })
        )[0];
        if (!resource) throw new Error('Demo resource creation returned no record');
        const endpoint = (
          await tx
            .insert(endpoints)
            .values({
              userId,
              resourceId: resource.id,
              scenarioId: input.scenarioId,
              name: input.name,
              publicTokenHash: sha256(input.token),
              publicTokenPrefix: input.token.slice(0, 12),
              encryptedToken: encryptValue(input.token, config.PAYLOAD_ENCRYPTION_KEY),
              mode: input.mode ?? 'trial',
              encryptedDestinationUrl: input.destinationUrl
                ? encryptValue(input.destinationUrl, config.PAYLOAD_ENCRYPTION_KEY)
                : null,
              displayDestinationHost: input.destinationUrl ? new URL(targetIngestUrl).host : null,
              retryMaxAttempts: input.retryMaxAttempts ?? 5,
              retryBaseDelayMs: 1_000,
              retryMaxDelayMs: 5_000,
              encryptedContract: encryptValue(
                JSON.stringify({
                  method: 'POST',
                  requiredHeaders:
                    input.provider === 'github'
                      ? {
                          'x-github-event': '',
                          'x-github-delivery': '',
                          'x-hub-signature-256': '',
                        }
                      : {},
                  jsonPaths: {},
                }),
                config.PAYLOAD_ENCRYPTION_KEY,
              ),
              signatureProvider: input.provider === 'github' ? 'github' : 'none',
              encryptedSignatureSecret: input.signatureSecret
                ? encryptValue(input.signatureSecret, config.PAYLOAD_ENCRYPTION_KEY)
                : null,
              allowPrivateNetworks: privateNetwork,
              allowedPrivateCidrs: privateCidrs,
            })
            .returning({ id: endpoints.id, resourceId: endpoints.resourceId })
        )[0];
        if (!endpoint) throw new Error('Demo endpoint creation returned no record');
        await tx
          .update(integrationResources)
          .set({
            metadata: {
              demoRunId: runId,
              demoKind: input.kind,
              endpointId: endpoint.id,
              provider: input.provider ?? 'generic',
            },
          })
          .where(eq(integrationResources.id, resource.id));
        return { id: endpoint.id, resourceId: resource.id };
      }

      const trial = await createDemoEndpoint({
        kind: 'trial',
        name: 'Demo · deterministic provider trial',
        token: trialToken,
        scenarioId: customScenario.id,
      });
      const target = await createDemoEndpoint({
        kind: 'target',
        name: 'Demo · synthetic destination',
        token: targetToken,
        scenarioId: builtInScenarioIds.temporaryOutage,
      });
      const observe = await createDemoEndpoint({
        kind: 'observe',
        name: 'Demo · Observe delivery failure',
        token: observeToken,
        scenarioId: builtInScenarioIds.inspection,
        mode: 'observe',
        destinationUrl: targetWorkerUrl,
      });
      const protect = await createDemoEndpoint({
        kind: 'protect',
        name: 'Demo · GitHub protected recovery',
        token: protectToken,
        scenarioId: builtInScenarioIds.inspection,
        mode: 'protect',
        destinationUrl: targetWorkerUrl,
        provider: 'github',
        signatureSecret: githubSecret,
        retryMaxAttempts: 5,
      });
      const deadLetter = await createDemoEndpoint({
        kind: 'dead-letter',
        name: 'Demo · protected dead-letter',
        token: deadLetterToken,
        scenarioId: builtInScenarioIds.inspection,
        mode: 'protect',
        destinationUrl: targetWorkerUrl,
        retryMaxAttempts: 3,
      });

      async function createDemoMonitor(input: {
        kind: string;
        name: string;
        type: 'external_api' | 'internal_api' | 'http_route' | 'webhook_destination' | 'icmp_host';
        protocol?: 'http' | 'icmp';
        environment: 'test' | 'staging' | 'production';
        publicUrl: string;
        workerUrl: string;
        method?: 'GET' | 'POST';
        expectedMinStatus?: number;
        expectedMaxStatus?: number;
        expectedText?: string;
        expectedJsonPath?: string;
        consecutiveFailuresToOpen?: number;
      }) {
        const resource = (
          await tx
            .insert(integrationResources)
            .values({
              userId,
              type: input.type,
              name: input.name,
              environment: input.environment,
              active: false,
              metadata: {
                demoRunId: runId,
                demoKind: input.kind,
                displayUrl:
                  input.protocol === 'icmp' ? `icmp://${input.publicUrl}` : input.publicUrl,
              },
            })
            .returning({ id: integrationResources.id })
        )[0];
        if (!resource) throw new Error('Demo monitor resource creation returned no record');
        const monitor = (
          await tx
            .insert(monitors)
            .values({
              resourceId: resource.id,
              encryptedUrl: encryptValue(input.workerUrl, config.PAYLOAD_ENCRYPTION_KEY),
              displayHost:
                input.protocol === 'icmp' ? input.publicUrl : new URL(input.publicUrl).host,
              protocol: input.protocol ?? 'http',
              method: input.method ?? 'GET',
              intervalSeconds: 900,
              timeoutMs: 10_000,
              expectedMinStatus: input.expectedMinStatus ?? 200,
              expectedMaxStatus: input.expectedMaxStatus ?? 299,
              expectedText: input.expectedText,
              expectedJsonPath: input.expectedJsonPath,
              consecutiveFailuresToOpen: input.consecutiveFailuresToOpen ?? 1,
              allowPrivateNetworks: privateNetwork,
              allowedPrivateCidrs: privateCidrs,
              state: 'paused',
            })
            .returning({ id: monitors.id, resourceId: monitors.resourceId })
        )[0];
        if (!monitor) throw new Error('Demo monitor creation returned no record');
        return monitor;
      }

      const recovery = await createDemoMonitor({
        kind: 'recovery-monitor',
        name: 'Demo · webhook destination recovery',
        type: 'webhook_destination',
        environment: 'test',
        publicUrl: targetIngestUrl,
        workerUrl: targetWorkerUrl,
        method: 'POST',
      });
      const healthyApi = await createDemoMonitor({
        kind: 'healthy-api',
        name: 'Demo · public API health',
        type: 'external_api',
        environment: 'production',
        publicUrl: apiHealthUrl,
        workerUrl: apiHealthWorkerUrl,
        expectedJsonPath: '$.status',
      });
      const degradedContract = await createDemoMonitor({
        kind: 'degraded-contract',
        name: 'Demo · internal API contract drift',
        type: 'internal_api',
        environment: 'staging',
        publicUrl: apiHealthUrl,
        workerUrl: apiHealthWorkerUrl,
        expectedText: 'demo-contract-version: 2',
        consecutiveFailuresToOpen: 2,
      });
      const downRoute = await createDemoMonitor({
        kind: 'down-route',
        name: 'Demo · unavailable checkout route',
        type: 'http_route',
        environment: 'production',
        publicUrl: config.APP_ORIGIN,
        workerUrl: applicationWorkerUrl,
        expectedMinStatus: 503,
        expectedMaxStatus: 503,
      });
      const icmpHost = await createDemoMonitor({
        kind: 'icmp-host',
        name: 'Demo · ICMP reachability',
        type: 'icmp_host',
        protocol: 'icmp',
        environment: 'production',
        publicUrl: '1.1.1.1',
        workerUrl: '1.1.1.1',
      });
      const syntheticCheckAt = new Date();
      await tx.insert(monitorChecks).values({
        monitorId: icmpHost.id,
        startedAt: syntheticCheckAt,
        completedAt: syntheticCheckAt,
        latencyMs: 12,
        outcome: 'healthy',
        contractResult: { passed: true, synthetic: true },
      });
      await tx
        .update(monitors)
        .set({ state: 'healthy', lastCheckAt: syntheticCheckAt })
        .where(eq(monitors.id, icmpHost.id));

      const statusToken = `hts_${nanoid(32)}`;
      const demoStatusPage = (
        await tx
          .insert(statusPages)
          .values({
            userId,
            name: 'Demo · Public service status',
            headline: 'HookTrials demo services',
            description: 'Synthetic HTTP and ICMP availability evidence generated by Demo Lab.',
            accentColor: '#36e37e',
            publicTokenHash: sha256(statusToken),
            encryptedToken: encryptValue(statusToken, config.PAYLOAD_ENCRYPTION_KEY),
            enabled: true,
          })
          .returning({ id: statusPages.id })
      )[0];
      if (!demoStatusPage) throw new Error('Demo status page creation returned no record');
      await tx.insert(statusPageMonitors).values([
        { pageId: demoStatusPage.id, monitorId: healthyApi.id, position: 0 },
        { pageId: demoStatusPage.id, monitorId: icmpHost.id, position: 1 },
      ]);

      const demoAlertChannel = existingAlertChannel
        ? null
        : (
            await tx
              .insert(alertChannels)
              .values({
                userId,
                encryptedUrl: encryptValue(targetWorkerUrl, config.PAYLOAD_ENCRYPTION_KEY),
                displayHost: new URL(targetIngestUrl).host,
                active: true,
                allowPrivateNetworks: privateNetwork,
                allowedPrivateCidrs: privateCidrs,
              })
              .returning({ id: alertChannels.id })
          )[0];

      await tx
        .update(integrationResources)
        .set({
          metadata: {
            demoRunId: runId,
            demoKind: 'trial',
            endpointId: trial.id,
            demoScenarioId: customScenario.id,
            demoAlertChannelId: demoAlertChannel?.id,
            demoStatusPageId: demoStatusPage.id,
          },
        })
        .where(eq(integrationResources.id, trial.resourceId));

      return {
        trial,
        target,
        observe,
        protect,
        deadLetter,
        scenario: customScenario,
        monitors: { recovery, healthyApi, degradedContract, downRoute, icmpHost },
        statusPage: {
          id: demoStatusPage.id,
          shareUrl: `${config.APP_ORIGIN.replace(/\/$/, '')}/status/${statusToken}`,
        },
        alertChannel: {
          id: demoAlertChannel?.id ?? existingAlertChannel?.id ?? null,
          demoOwned: Boolean(demoAlertChannel),
        },
      };
    });

    return reply.code(201).send({
      demo: {
        runId,
        trial: { ...created.trial, ingestUrl: trialIngestUrl },
        target: { ...created.target, ingestUrl: targetIngestUrl },
        observe: { ...created.observe, ingestUrl: observeIngestUrl },
        protect: { ...created.protect, ingestUrl: protectIngestUrl, signatureSecret: githubSecret },
        deadLetter: { ...created.deadLetter, ingestUrl: deadLetterIngestUrl },
        scenario: created.scenario,
        monitors: created.monitors,
        statusPage: created.statusPage,
        alertChannel: created.alertChannel,
        destination: {
          url: targetWorkerUrl,
          allowPrivateNetworks: privateNetwork,
          allowedPrivateCidrs: privateCidrs,
        },
      },
    });
  } finally {
    await demoLock
      .release()
      .catch((error) =>
        logger.error({ error, userId: user.id }, 'Failed to release demo mutation lock'),
      );
  }
});

app.post('/v1/demo/:runId/cleanup', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  deliveryActionInputSchema.parse(request.body);
  const { runId } = request.params as { runId: string };
  const demoLock = await acquireDemoMutationLock(redis, user.workspaceOwnerId);
  if (!demoLock) {
    return reply.code(409).send({ error: 'demo_operation_in_progress' });
  }
  try {
    const owned = await database.db
      .select({ id: integrationResources.id, metadata: integrationResources.metadata })
      .from(integrationResources)
      .where(
        and(
          inArray(integrationResources.userId, user.workspaceUserIds),
          sql`${integrationResources.metadata} ->> 'demoRunId' = ${runId}`,
        ),
      );
    if (owned.length === 0) return { removed: 0 };
    const resourceIds = owned.map((resource) => resource.id);
    const ownedMetadata = owned.map(
      (resource) =>
        resource.metadata as {
          demoScenarioId?: string;
          demoAlertChannelId?: string | null;
          demoStatusPageId?: string;
        },
    );
    const scenarioIds = [
      ...new Set(ownedMetadata.flatMap((metadata) => metadata.demoScenarioId ?? [])),
    ];
    const alertChannelIds = [
      ...new Set(ownedMetadata.flatMap((metadata) => metadata.demoAlertChannelId ?? [])),
    ];
    const statusPageIds = [
      ...new Set(ownedMetadata.flatMap((metadata) => metadata.demoStatusPageId ?? [])),
    ];
    await database.db.transaction(async (tx) => {
      if (statusPageIds.length > 0) {
        await tx
          .delete(statusPages)
          .where(
            and(
              eq(statusPages.userId, user.workspaceOwnerId),
              inArray(statusPages.id, statusPageIds),
            ),
          );
      }
      await tx
        .delete(endpoints)
        .where(
          and(
            eq(endpoints.userId, user.workspaceOwnerId),
            inArray(endpoints.resourceId, resourceIds),
          ),
        );
      await tx
        .delete(integrationResources)
        .where(
          and(
            eq(integrationResources.userId, user.workspaceOwnerId),
            inArray(integrationResources.id, resourceIds),
          ),
        );
      if (scenarioIds.length > 0) {
        await tx
          .delete(scenarios)
          .where(
            and(
              eq(scenarios.userId, user.workspaceOwnerId),
              eq(scenarios.builtIn, false),
              inArray(scenarios.id, scenarioIds),
            ),
          );
      }
      if (alertChannelIds.length > 0) {
        await tx
          .delete(alertChannels)
          .where(
            and(
              eq(alertChannels.userId, user.workspaceOwnerId),
              inArray(alertChannels.id, alertChannelIds),
            ),
          );
      }
    });
    return {
      removed: resourceIds.length,
      scenariosRemoved: scenarioIds.length,
      alertChannelsRemoved: alertChannelIds.length,
      statusPagesRemoved: statusPageIds.length,
    };
  } finally {
    await demoLock
      .release()
      .catch((error) =>
        logger.error({ error, userId: user.id }, 'Failed to release demo mutation lock'),
      );
  }
});

app.post('/v1/demo/reset', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  deliveryActionInputSchema.parse(request.body);
  const demoLock = await acquireDemoMutationLock(redis, user.id);
  if (!demoLock) {
    return reply.code(409).send({ error: 'demo_operation_in_progress' });
  }
  try {
    const owned = await database.db
      .select({ id: integrationResources.id, metadata: integrationResources.metadata })
      .from(integrationResources)
      .where(
        and(
          inArray(integrationResources.userId, user.workspaceUserIds),
          sql`${integrationResources.metadata} ? 'demoRunId'`,
        ),
      );
    if (owned.length === 0) return { removed: 0, runsRemoved: 0 };
    const resourceIds = owned.map((resource) => resource.id);
    const metadata = owned.map(
      (resource) =>
        resource.metadata as {
          demoRunId?: string;
          demoScenarioId?: string;
          demoAlertChannelId?: string | null;
          demoStatusPageId?: string;
        },
    );
    const scenarioIds = [...new Set(metadata.flatMap((item) => item.demoScenarioId ?? []))];
    const alertChannelIds = [...new Set(metadata.flatMap((item) => item.demoAlertChannelId ?? []))];
    const statusPageIds = [...new Set(metadata.flatMap((item) => item.demoStatusPageId ?? []))];
    const runIds = new Set(metadata.flatMap((item) => item.demoRunId ?? []));
    await database.db.transaction(async (tx) => {
      if (statusPageIds.length > 0) {
        await tx
          .delete(statusPages)
          .where(
            and(
              eq(statusPages.userId, user.workspaceOwnerId),
              inArray(statusPages.id, statusPageIds),
            ),
          );
      }
      await tx
        .delete(endpoints)
        .where(
          and(
            eq(endpoints.userId, user.workspaceOwnerId),
            inArray(endpoints.resourceId, resourceIds),
          ),
        );
      await tx
        .delete(integrationResources)
        .where(
          and(
            eq(integrationResources.userId, user.workspaceOwnerId),
            inArray(integrationResources.id, resourceIds),
          ),
        );
      if (scenarioIds.length > 0) {
        await tx
          .delete(scenarios)
          .where(
            and(
              eq(scenarios.userId, user.workspaceOwnerId),
              eq(scenarios.builtIn, false),
              inArray(scenarios.id, scenarioIds),
            ),
          );
      }
      if (alertChannelIds.length > 0) {
        await tx
          .delete(alertChannels)
          .where(
            and(
              eq(alertChannels.userId, user.workspaceOwnerId),
              inArray(alertChannels.id, alertChannelIds),
            ),
          );
      }
    });
    return {
      removed: resourceIds.length,
      runsRemoved: runIds.size,
      scenariosRemoved: scenarioIds.length,
      alertChannelsRemoved: alertChannelIds.length,
      statusPagesRemoved: statusPageIds.length,
    };
  } finally {
    await demoLock
      .release()
      .catch((error) =>
        logger.error({ error, userId: user.id }, 'Failed to release demo mutation lock'),
      );
  }
});

app.post('/v1/endpoints', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = createEndpointInputSchema.parse(request.body);
  const existing = await database.db
    .select({ value: count() })
    .from(endpoints)
    .leftJoin(integrationResources, eq(endpoints.resourceId, integrationResources.id))
    .where(
      and(
        inArray(endpoints.userId, user.workspaceUserIds),
        sql`not coalesce(${integrationResources.metadata} ? 'demoRunId', false)`,
      ),
    );
  if (config.ENDPOINTS_LIMIT > 0 && (existing[0]?.value ?? 0) >= config.ENDPOINTS_LIMIT) {
    return reply.code(403).send({ error: 'endpoint_limit_reached' });
  }

  const scenarioId = input.scenarioId ?? builtInScenarioIds.inspection;
  const allowedScenario = await database.db
    .select({ id: scenarios.id, name: scenarios.name })
    .from(scenarios)
    .where(
      and(
        eq(scenarios.id, scenarioId),
        or(eq(scenarios.builtIn, true), inArray(scenarios.userId, user.workspaceUserIds)),
      ),
    )
    .limit(1);
  if (!allowedScenario[0]) return reply.code(400).send({ error: 'invalid_scenario' });

  const preparedPolicy = await prepareDeliveryPolicy(
    input.deliveryPolicy,
    input.deliveryPolicy === undefined
      ? legacyDeliveryPolicy({
          url: input.destinationUrl ?? null,
          headers: input.destinationHeaders,
          timeoutMs: input.destinationTimeoutMs,
          expectedMinStatus: input.destinationExpectedMinStatus,
          expectedMaxStatus: input.destinationExpectedMaxStatus,
        })
      : null,
  );
  const primaryDestination = preparedPolicy?.destinations[0] ?? null;
  const destinationUrl = input.destinationUrl ?? primaryDestination?.url ?? null;
  const primaryHeaders =
    primaryDestination && Object.keys(primaryDestination.headers).length > 0
      ? primaryDestination.headers
      : input.destinationHeaders;
  if (input.destinationUrl && input.deliveryPolicy === undefined) {
    await validateTarget(
      input.destinationUrl,
      monitorNetworkOptions({ allowPrivateNetworks: false, allowedPrivateCidrs: [] }),
    );
  }

  const publicToken = `ht_${nanoid(32)}`;
  const created = await database.db.transaction(async (tx) => {
    const resource = (
      await tx
        .insert(integrationResources)
        .values({
          userId: user.workspaceOwnerId,
          type: 'webhook_route',
          name: input.name,
          environment: input.environment,
          metadata: { provider: input.provider },
        })
        .returning({ id: integrationResources.id })
    )[0];
    if (!resource) throw new Error('Endpoint resource creation returned no record');
    const endpoint = (
      await tx
        .insert(endpoints)
        .values({
          userId: user.workspaceOwnerId,
          resourceId: resource.id,
          scenarioId,
          name: input.name,
          publicTokenHash: sha256(publicToken),
          publicTokenPrefix: publicToken.slice(0, 12),
          encryptedToken: encryptValue(publicToken, config.PAYLOAD_ENCRYPTION_KEY),
          mode: input.mode,
          environment: input.environment,
          encryptedDestinationUrl: destinationUrl
            ? encryptValue(destinationUrl, config.PAYLOAD_ENCRYPTION_KEY)
            : null,
          encryptedDestinationHeaders:
            Object.keys(primaryHeaders).length > 0 ? encryptHeaders(primaryHeaders) : null,
          displayDestinationHost: destinationUrl ? new URL(destinationUrl).host : null,
          destinationTimeoutMs: primaryDestination?.timeoutMs ?? input.destinationTimeoutMs,
          retryMaxAttempts: input.retryMaxAttempts,
          retryBaseDelayMs: input.retryBaseDelayMs,
          retryMaxDelayMs: input.retryMaxDelayMs,
          deliveryStrategy: preparedPolicy?.strategy ?? 'single',
          idempotencyScope: preparedPolicy?.idempotencyScope ?? 'destination',
          encryptedDeliveryPolicy:
            input.deliveryPolicy !== undefined ? encryptDeliveryPolicy(preparedPolicy) : null,
          encryptedContract: input.contract
            ? encryptValue(JSON.stringify(input.contract), config.PAYLOAD_ENCRYPTION_KEY)
            : null,
          signatureProvider: input.signatureProvider,
          encryptedSignatureSecret: input.signatureSecret
            ? encryptValue(input.signatureSecret, config.PAYLOAD_ENCRYPTION_KEY)
            : null,
          signatureToleranceSeconds: input.signatureToleranceSeconds,
          destinationExpectedMinStatus:
            primaryDestination?.expectedMinStatus ?? input.destinationExpectedMinStatus,
          destinationExpectedMaxStatus:
            primaryDestination?.expectedMaxStatus ?? input.destinationExpectedMaxStatus,
          productionConfirmedAt:
            input.environment === 'production' && input.mode !== 'trial' ? new Date() : null,
        })
        .returning({
          id: endpoints.id,
          resourceId: endpoints.resourceId,
          name: endpoints.name,
          createdAt: endpoints.createdAt,
        })
    )[0];
    if (!endpoint) throw new Error('Endpoint creation returned no record');
    await tx
      .update(integrationResources)
      .set({ metadata: { endpointId: endpoint.id, provider: input.provider } })
      .where(eq(integrationResources.id, resource.id));
    return endpoint;
  });

  return reply.code(201).send({
    endpoint: {
      ...created,
      tokenPrefix: publicToken.slice(0, 12),
      provider: input.provider,
      scenarioId,
      scenarioName: allowedScenario[0].name,
      active: true,
      mode: input.mode,
      environment: input.environment,
      destinationHost: destinationUrl ? new URL(destinationUrl).host : null,
      destinationConfigured: Boolean(destinationUrl),
      destinationTimeoutMs: primaryDestination?.timeoutMs ?? input.destinationTimeoutMs,
      retryMaxAttempts: input.retryMaxAttempts,
      retryBaseDelayMs: input.retryBaseDelayMs,
      retryMaxDelayMs: input.retryMaxDelayMs,
      deliveryPaused: false,
      contractConfigured: Boolean(input.contract),
      signatureProvider: input.signatureProvider,
      signatureConfigured: Boolean(input.signatureSecret),
      signatureToleranceSeconds: input.signatureToleranceSeconds,
      destinationExpectedMinStatus:
        primaryDestination?.expectedMinStatus ?? input.destinationExpectedMinStatus,
      destinationExpectedMaxStatus:
        primaryDestination?.expectedMaxStatus ?? input.destinationExpectedMaxStatus,
      allowPrivateNetworks: false,
      allowedPrivateCidrs: [],
      productionConfirmedAt:
        input.environment === 'production' && input.mode !== 'trial'
          ? new Date().toISOString()
          : null,
      ingestUrl: `${config.INGEST_ORIGIN}/i/${publicToken}`,
      ...deliveryPolicySummary(preparedPolicy, {
        host: destinationUrl ? new URL(destinationUrl).host : null,
      }),
    },
  });
});

app.patch('/v1/endpoints/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const input = updateEndpointInputSchema.parse(request.body);

  const current = (
    await database.db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!current) return reply.code(404).send({ error: 'endpoint_not_found' });

  if (input.scenarioId) {
    const allowed = await database.db
      .select({ id: scenarios.id })
      .from(scenarios)
      .where(
        and(
          eq(scenarios.id, input.scenarioId),
          or(eq(scenarios.builtIn, true), inArray(scenarios.userId, user.workspaceUserIds)),
        ),
      )
      .limit(1);
    if (!allowed[0]) return reply.code(400).send({ error: 'invalid_scenario' });
  }

  const mode = input.mode ?? current.mode;
  const environment = input.environment ?? current.environment;
  const allowPrivateNetworks = input.allowPrivateNetworks ?? current.allowPrivateNetworks;
  const allowedPrivateCidrs =
    input.allowedPrivateCidrs ?? (current.allowedPrivateCidrs as string[]);
  const existingDestination = current.encryptedDestinationUrl
    ? decryptValue(current.encryptedDestinationUrl, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8')
    : null;
  const currentPolicy =
    decryptDeliveryPolicy(current.encryptedDeliveryPolicy) ??
    legacyDeliveryPolicy({
      url: existingDestination,
      timeoutMs: current.destinationTimeoutMs,
      expectedMinStatus: current.destinationExpectedMinStatus,
      expectedMaxStatus: current.destinationExpectedMaxStatus,
    });
  const preparedPolicy = await prepareDeliveryPolicy(
    input.deliveryPolicy,
    input.deliveryPolicy === undefined ? currentPolicy : null,
  );
  const primaryDestination = preparedPolicy?.destinations[0] ?? null;
  const existingPrimaryHeaders = decryptedMonitorHeaders(current.encryptedDestinationHeaders);
  const primaryHeaders =
    primaryDestination && Object.keys(primaryDestination.headers).length > 0
      ? primaryDestination.headers
      : (input.destinationHeaders ?? existingPrimaryHeaders);
  const destinationUrl =
    input.destinationUrl !== undefined
      ? input.destinationUrl
      : (primaryDestination?.url ?? existingDestination);
  const signatureProvider = input.signatureProvider ?? current.signatureProvider;
  const signatureSecretConfigured =
    input.signatureSecret === undefined
      ? Boolean(current.encryptedSignatureSecret)
      : input.signatureSecret !== null;
  const expectedMinStatus =
    input.destinationExpectedMinStatus ?? current.destinationExpectedMinStatus;
  const expectedMaxStatus =
    input.destinationExpectedMaxStatus ?? current.destinationExpectedMaxStatus;

  if (mode !== 'trial' && !destinationUrl) {
    return reply.code(400).send({ error: 'destination_required' });
  }
  if (signatureProvider !== 'none' && !signatureSecretConfigured) {
    return reply.code(400).send({ error: 'signature_secret_required' });
  }
  if (expectedMinStatus > expectedMaxStatus) {
    return reply.code(400).send({ error: 'invalid_destination_status_range' });
  }
  if (environment === 'production' && mode !== 'trial' && !current.productionConfirmedAt) {
    if (!input.confirmProductionImpact) {
      return reply.code(409).send({ error: 'production_confirmation_required' });
    }
  }
  if (destinationUrl) {
    await validateTarget(
      destinationUrl,
      monitorNetworkOptions({ allowPrivateNetworks, allowedPrivateCidrs }),
    );
  }

  const endpointUpdate = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
    ...(input.mode !== undefined ? { mode: input.mode } : {}),
    ...(input.environment !== undefined ? { environment: input.environment } : {}),
    ...(input.destinationUrl !== undefined || input.deliveryPolicy !== undefined
      ? {
          encryptedDestinationUrl: destinationUrl
            ? encryptValue(destinationUrl, config.PAYLOAD_ENCRYPTION_KEY)
            : null,
          displayDestinationHost: destinationUrl ? new URL(destinationUrl).host : null,
        }
      : {}),
    ...(input.destinationHeaders !== undefined || input.deliveryPolicy !== undefined
      ? {
          encryptedDestinationHeaders: encryptHeaders(primaryHeaders),
        }
      : {}),
    ...(input.destinationTimeoutMs !== undefined || input.deliveryPolicy !== undefined
      ? {
          destinationTimeoutMs:
            primaryDestination?.timeoutMs ??
            input.destinationTimeoutMs ??
            current.destinationTimeoutMs,
        }
      : {}),
    ...(input.retryMaxAttempts !== undefined ? { retryMaxAttempts: input.retryMaxAttempts } : {}),
    ...(input.retryBaseDelayMs !== undefined ? { retryBaseDelayMs: input.retryBaseDelayMs } : {}),
    ...(input.retryMaxDelayMs !== undefined ? { retryMaxDelayMs: input.retryMaxDelayMs } : {}),
    ...(input.deliveryPaused !== undefined ? { deliveryPaused: input.deliveryPaused } : {}),
    ...(input.contract !== undefined
      ? {
          encryptedContract: input.contract
            ? encryptValue(JSON.stringify(input.contract), config.PAYLOAD_ENCRYPTION_KEY)
            : null,
        }
      : {}),
    ...(input.signatureProvider !== undefined ? { signatureProvider } : {}),
    ...(input.signatureSecret !== undefined
      ? {
          encryptedSignatureSecret: input.signatureSecret
            ? encryptValue(input.signatureSecret, config.PAYLOAD_ENCRYPTION_KEY)
            : null,
        }
      : {}),
    ...(input.signatureToleranceSeconds !== undefined
      ? { signatureToleranceSeconds: input.signatureToleranceSeconds }
      : {}),
    ...(input.destinationExpectedMinStatus !== undefined || input.deliveryPolicy !== undefined
      ? {
          destinationExpectedMinStatus:
            primaryDestination?.expectedMinStatus ??
            input.destinationExpectedMinStatus ??
            current.destinationExpectedMinStatus,
        }
      : {}),
    ...(input.destinationExpectedMaxStatus !== undefined || input.deliveryPolicy !== undefined
      ? {
          destinationExpectedMaxStatus:
            primaryDestination?.expectedMaxStatus ??
            input.destinationExpectedMaxStatus ??
            current.destinationExpectedMaxStatus,
        }
      : {}),
    ...(input.deliveryPolicy !== undefined
      ? {
          deliveryStrategy: preparedPolicy?.strategy ?? 'single',
          idempotencyScope: preparedPolicy?.idempotencyScope ?? 'destination',
          encryptedDeliveryPolicy: encryptDeliveryPolicy(preparedPolicy),
        }
      : {}),
    ...(input.allowPrivateNetworks !== undefined ? { allowPrivateNetworks } : {}),
    ...(input.allowedPrivateCidrs !== undefined ? { allowedPrivateCidrs } : {}),
    ...(environment === 'production' && mode !== 'trial' && input.confirmProductionImpact
      ? { productionConfirmedAt: new Date() }
      : {}),
  };

  const updated = await database.db.transaction(async (tx) => {
    const row = (
      await tx
        .update(endpoints)
        .set(endpointUpdate)
        .where(and(eq(endpoints.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
        .returning({
          id: endpoints.id,
          resourceId: endpoints.resourceId,
          name: endpoints.name,
          active: endpoints.active,
          scenarioId: endpoints.scenarioId,
          mode: endpoints.mode,
          environment: endpoints.environment,
          destinationHost: endpoints.displayDestinationHost,
          destinationTimeoutMs: endpoints.destinationTimeoutMs,
          retryMaxAttempts: endpoints.retryMaxAttempts,
          retryBaseDelayMs: endpoints.retryBaseDelayMs,
          retryMaxDelayMs: endpoints.retryMaxDelayMs,
          deliveryPaused: endpoints.deliveryPaused,
          deliveryStrategy: endpoints.deliveryStrategy,
          idempotencyScope: endpoints.idempotencyScope,
          contractConfigured: sql<boolean>`${endpoints.encryptedContract} is not null`,
          signatureProvider: endpoints.signatureProvider,
          signatureConfigured: sql<boolean>`${endpoints.encryptedSignatureSecret} is not null`,
          signatureToleranceSeconds: endpoints.signatureToleranceSeconds,
          destinationExpectedMinStatus: endpoints.destinationExpectedMinStatus,
          destinationExpectedMaxStatus: endpoints.destinationExpectedMaxStatus,
          allowPrivateNetworks: endpoints.allowPrivateNetworks,
          allowedPrivateCidrs: endpoints.allowedPrivateCidrs,
          productionConfirmedAt: endpoints.productionConfirmedAt,
        })
    )[0];
    if (row?.resourceId) {
      await tx
        .update(integrationResources)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.environment !== undefined ? { environment: input.environment } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
          updatedAt: new Date(),
        })
        .where(eq(integrationResources.id, row.resourceId));
    }
    return row;
  });
  return {
    endpoint: {
      ...updated,
      destinationConfigured: Boolean(destinationUrl),
      ...deliveryPolicySummary(
        input.deliveryPolicy !== undefined ? preparedPolicy : currentPolicy,
        {
          host: destinationUrl ? new URL(destinationUrl).host : null,
        },
      ),
    },
  };
});

app.post('/v1/endpoints/:id/rotate', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  deliveryActionInputSchema.parse(request.body);
  const { id } = request.params as { id: string };
  const publicToken = `ht_${nanoid(32)}`;
  const rotated = await database.db
    .update(endpoints)
    .set({
      publicTokenHash: sha256(publicToken),
      publicTokenPrefix: publicToken.slice(0, 12),
      encryptedToken: encryptValue(publicToken, config.PAYLOAD_ENCRYPTION_KEY),
    })
    .where(and(eq(endpoints.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
    .returning({
      id: endpoints.id,
      name: endpoints.name,
      active: endpoints.active,
      mode: endpoints.mode,
      environment: endpoints.environment,
      tokenPrefix: endpoints.publicTokenPrefix,
    });
  if (!rotated[0]) return reply.code(404).send({ error: 'endpoint_not_found' });
  return {
    endpoint: {
      ...rotated[0],
      ingestUrl: `${config.INGEST_ORIGIN}/i/${publicToken}`,
    },
  };
});

app.delete('/v1/endpoints/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const removed = await database.db.transaction(async (tx) => {
    const row = (
      await tx
        .delete(endpoints)
        .where(and(eq(endpoints.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
        .returning({ id: endpoints.id, resourceId: endpoints.resourceId })
    )[0];
    if (row?.resourceId) {
      await tx.delete(integrationResources).where(eq(integrationResources.id, row.resourceId));
    }
    return row;
  });
  if (!removed) return reply.code(404).send({ error: 'endpoint_not_found' });
  return reply.code(204).send();
});

const evidenceRedactions = [
  'Payload bodies',
  'Captured request headers',
  'Authentication and cookie values',
  'Provider signing secrets',
  'Destination URLs and destination-only headers',
];

async function loadRedactedEvidence(eventId: string): Promise<RedactedEvidence | null> {
  const base = (
    await database.db
      .select({
        correlationKey: events.correlationKey,
        bodyHash: events.bodyHash,
        firstSeenAt: events.firstSeenAt,
        lastSeenAt: events.lastSeenAt,
        integrationName: endpoints.name,
        mode: endpoints.mode,
        environment: endpoints.environment,
        reportStatus: reports.status,
        reportScore: reports.score,
        reportResult: reports.result,
      })
      .from(events)
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .leftJoin(reports, eq(reports.eventId, events.id))
      .where(eq(events.id, eventId))
      .limit(1)
  )[0];
  if (!base) return null;

  const [attemptRows, deliveryRows] = await Promise.all([
    database.db
      .select({
        id: attempts.id,
        sequence: attempts.sequence,
        method: attempts.method,
        receivedAt: attempts.receivedAt,
        responseStatus: attempts.responseStatus,
        responseDelayMs: attempts.responseDelayMs,
        signatureProvider: attempts.signatureProvider,
        signatureStatus: attempts.signatureStatus,
        contractResult: attempts.contractResult,
      })
      .from(attempts)
      .where(eq(attempts.eventId, eventId))
      .orderBy(attempts.sequence),
    database.db
      .select({
        id: destinationDeliveries.id,
        sequence: destinationDeliveries.sequence,
        kind: destinationDeliveries.kind,
        state: destinationDeliveries.state,
        statusCode: destinationDeliveries.statusCode,
        latencyMs: destinationDeliveries.latencyMs,
        errorCategory: destinationDeliveries.errorCategory,
        startedAt: destinationDeliveries.startedAt,
        completedAt: destinationDeliveries.completedAt,
      })
      .from(destinationDeliveries)
      .where(eq(destinationDeliveries.eventId, eventId))
      .orderBy(destinationDeliveries.sequence),
  ]);

  return {
    schemaVersion: '1.0',
    generatedAt: new Date(),
    integration: {
      name: base.integrationName,
      mode: base.mode,
      environment: base.environment,
    },
    event: {
      correlationKey: base.correlationKey,
      bodyHash: base.bodyHash,
      firstSeenAt: base.firstSeenAt,
      lastSeenAt: base.lastSeenAt,
    },
    attempts: attemptRows,
    deliveries: deliveryRows,
    report:
      base.reportStatus === null
        ? null
        : {
            status: base.reportStatus,
            score: base.reportScore,
            result: base.reportResult,
          },
    redacted: true,
    redactions: evidenceRedactions,
  };
}

async function loadSharedEvidence(token: string): Promise<RedactedEvidence | null> {
  const shared = (
    await database.db
      .select({ eventId: reports.eventId, expiresAt: reports.publicExpiresAt })
      .from(reports)
      .where(
        and(eq(reports.publicTokenHash, sha256(token)), gt(reports.publicExpiresAt, new Date())),
      )
      .limit(1)
  )[0];
  if (!shared) return null;
  const evidence = await loadRedactedEvidence(shared.eventId);
  return evidence ? { ...evidence, expiresAt: shared.expiresAt } : null;
}

function sendEvidenceExport(
  reply: FastifyReply,
  evidence: RedactedEvidence,
  eventId: string,
  format: 'json' | 'markdown',
) {
  const body = format === 'json' ? evidenceJson(evidence) : evidenceMarkdown(evidence);
  return reply
    .header('cache-control', 'private, no-store')
    .header('content-disposition', `attachment; filename="${evidenceFilename(eventId, format)}"`)
    .type(format === 'json' ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8')
    .send(body);
}

app.get('/v1/endpoints/:id/events', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = await database.db
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
    .limit(1);
  if (!owned[0]) return reply.code(404).send({ error: 'endpoint_not_found' });

  const eventRows = await database.db
    .select()
    .from(events)
    .where(eq(events.endpointId, id))
    .orderBy(desc(events.lastSeenAt))
    .limit(50);
  const items = await Promise.all(
    eventRows.map(async (event) => {
      const attemptRows = await database.db
        .select({
          id: attempts.id,
          sequence: attempts.sequence,
          statusCode: attempts.responseStatus,
          receivedAt: attempts.receivedAt,
          signatureProvider: attempts.signatureProvider,
          signatureStatus: attempts.signatureStatus,
          contractResult: attempts.contractResult,
        })
        .from(attempts)
        .where(eq(attempts.eventId, event.id))
        .orderBy(attempts.sequence);
      const deliveryRows = await database.db
        .select()
        .from(destinationDeliveries)
        .where(eq(destinationDeliveries.eventId, event.id))
        .orderBy(destinationDeliveries.sequence);
      return { ...event, attempts: attemptRows, deliveries: deliveryRows };
    }),
  );
  return { events: items };
});

app.get('/v1/events/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = await database.db
    .select({
      id: events.id,
      endpointId: events.endpointId,
      correlationKey: events.correlationKey,
      bodyHash: events.bodyHash,
      mode: endpoints.mode,
    })
    .from(events)
    .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
    .where(and(eq(events.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
    .limit(1);
  const event = owned[0];
  if (!event) return reply.code(404).send({ error: 'event_not_found' });

  const attemptRows = await database.db
    .select()
    .from(attempts)
    .where(eq(attempts.eventId, id))
    .orderBy(attempts.sequence);
  const report = (
    await database.db.select().from(reports).where(eq(reports.eventId, id)).limit(1)
  )[0];
  const deliveryRows = await database.db
    .select()
    .from(destinationDeliveries)
    .where(eq(destinationDeliveries.eventId, id))
    .orderBy(destinationDeliveries.startedAt);
  return {
    event: {
      ...event,
      attempts: attemptRows.map(
        ({ encryptedBody, encryptedHeaders: _encryptedHeaders, headers, ...attempt }) => {
          const body = decryptValue(encryptedBody, config.PAYLOAD_ENCRYPTION_KEY);
          return {
            ...attempt,
            headers: safeHeaders(headers),
            body: body.toString('utf8'),
            bodyBase64: body.toString('base64'),
          };
        },
      ),
      deliveries: deliveryRows,
      report: report ?? null,
      replay: buildReliabilityReplay({
        mode: event.mode,
        attempts: attemptRows.map((attempt) => ({
          ...attempt,
          contractResult: attempt.contractResult as {
            configured?: boolean;
            passed?: boolean;
          },
        })),
        deliveries: deliveryRows,
      }),
    },
  };
});

app.get('/v1/events/:id/export', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const { format } = evidenceExportQuerySchema.parse(request.query);
  const owned = (
    await database.db
      .select({ id: events.id })
      .from(events)
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .where(and(eq(events.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'event_not_found' });
  const evidence = await loadRedactedEvidence(id);
  if (!evidence) return reply.code(404).send({ error: 'event_not_found' });
  return sendEvidenceExport(reply, evidence, id, format);
});

app.get('/v1/automation/events/:id/export', async (request, reply) => {
  const user = await requireApiKey(request, reply, 'read');
  if (!user) return;
  const { id } = request.params as { id: string };
  const { format } = evidenceExportQuerySchema.parse(request.query);
  const owned = (
    await database.db
      .select({ id: events.id })
      .from(events)
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .where(and(eq(events.id, id), eq(endpoints.userId, user.id)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'event_not_found' });
  const evidence = await loadRedactedEvidence(id);
  if (!evidence) return reply.code(404).send({ error: 'event_not_found' });
  return sendEvidenceExport(reply, evidence, id, format);
});

app.post('/v1/events/:id/share', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = shareEvidenceInputSchema.parse(request.body);
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ id: events.id })
      .from(events)
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .where(and(eq(events.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'event_not_found' });
  const token = `hte_${nanoid(32)}`;
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1_000);
  await database.db
    .insert(reports)
    .values({ eventId: id, publicTokenHash: sha256(token), publicExpiresAt: expiresAt })
    .onConflictDoUpdate({
      target: reports.eventId,
      set: { publicTokenHash: sha256(token), publicExpiresAt: expiresAt },
    });
  return { shareUrl: `${config.APP_ORIGIN}/evidence/${token}`, expiresAt };
});

app.delete('/v1/events/:id/share', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = (
    await database.db
      .select({ id: events.id })
      .from(events)
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .where(and(eq(events.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
      .limit(1)
  )[0];
  if (!owned) return reply.code(404).send({ error: 'event_not_found' });
  await database.db
    .update(reports)
    .set({ publicTokenHash: null, publicExpiresAt: null })
    .where(eq(reports.eventId, id));
  return reply.code(204).send();
});

app.get('/v1/public/evidence/:token/export', async (request, reply) => {
  const { token } = request.params as { token: string };
  const { format } = evidenceExportQuerySchema.parse(request.query);
  const evidence = await loadSharedEvidence(token);
  if (!evidence) return reply.code(404).send({ error: 'evidence_not_found' });
  return sendEvidenceExport(reply, evidence, evidence.event.bodyHash, format);
});

app.get('/v1/public/evidence/:token', async (request, reply) => {
  const { token } = request.params as { token: string };
  const evidence = await loadSharedEvidence(token);
  if (!evidence) return reply.code(404).send({ error: 'evidence_not_found' });
  return { evidence };
});

async function createManualDelivery(
  deliveryId: string,
  userIds: string[],
  kind: 'retry' | 'replay',
) {
  const owned = (
    await database.db
      .select({ delivery: destinationDeliveries, endpointUserId: endpoints.userId })
      .from(destinationDeliveries)
      .innerJoin(events, eq(destinationDeliveries.eventId, events.id))
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .where(and(eq(destinationDeliveries.id, deliveryId), inArray(endpoints.userId, userIds)))
      .limit(1)
  )[0];
  if (!owned) return { error: 'delivery_not_found' as const };
  if (kind === 'retry' && !['failed', 'dead_letter'].includes(owned.delivery.state)) {
    return { error: 'delivery_not_retryable' as const };
  }
  const duplicate = await database.db
    .select({ id: destinationDeliveries.id })
    .from(destinationDeliveries)
    .where(
      and(
        eq(destinationDeliveries.replayOfDeliveryId, deliveryId),
        eq(destinationDeliveries.kind, kind),
        inArray(destinationDeliveries.state, ['queued', 'delivering', 'retrying']),
      ),
    )
    .limit(1);
  if (duplicate[0]) return { delivery: duplicate[0], duplicate: true };

  const sequenceRows = await database.db
    .select({ value: sql<number>`coalesce(max(${destinationDeliveries.sequence}), 0)` })
    .from(destinationDeliveries)
    .where(eq(destinationDeliveries.eventId, owned.delivery.eventId));
  const created = (
    await database.db
      .insert(destinationDeliveries)
      .values({
        eventId: owned.delivery.eventId,
        inboundAttemptId: owned.delivery.inboundAttemptId,
        resourceId: owned.delivery.resourceId,
        sequence: Number(sequenceRows[0]?.value ?? 0) + 1,
        kind,
        state: 'queued',
        requestedByUserId: userIds[0]!,
        replayOfDeliveryId: deliveryId,
        auditMetadata: {
          action: kind,
          sourceDeliveryId: deliveryId,
          requestedAt: new Date(),
          attemptNumber: 1,
        },
      })
      .returning({ id: destinationDeliveries.id })
  )[0];
  if (!created) throw new Error('Manual delivery creation returned no record');
  await deliveryQueue.add(
    `manual-${kind}`,
    { deliveryId: created.id },
    { jobId: `delivery-${created.id}`, removeOnComplete: 500, removeOnFail: true },
  );
  return { delivery: created, duplicate: false };
}

for (const kind of ['retry', 'replay'] as const) {
  app.post(`/v1/deliveries/:id/${kind}`, async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    deliveryActionInputSchema.parse(request.body);
    const { id } = request.params as { id: string };
    const result = await createManualDelivery(id, user.workspaceUserIds, kind);
    if ('error' in result) {
      return reply
        .code(result.error === 'delivery_not_found' ? 404 : 409)
        .send({ error: result.error });
    }
    return reply.code(result.duplicate ? 200 : 202).send(result);
  });
}

app.get('/v1/endpoints/:id/stream', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = await database.db
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.id, id), inArray(endpoints.userId, user.workspaceUserIds)))
    .limit(1);
  if (!owned[0]) return reply.code(404).send({ error: 'endpoint_not_found' });

  const requestOrigin = request.headers.origin;
  const streamOrigin =
    requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : config.APP_ORIGIN;
  reply.hijack();
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': streamOrigin,
    'Access-Control-Allow-Credentials': 'true',
  });
  reply.raw.write('event: ready\ndata: {}\n\n');

  const subscriber = redis.duplicate();
  const channel = `hooktrials:endpoint:${id}`;
  await subscriber.subscribe(channel);
  subscriber.on('message', (_channel, message) => {
    reply.raw.write(`event: attempt\ndata: ${message}\n\n`);
  });
  const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 20_000);
  request.raw.on('close', () => {
    clearInterval(heartbeat);
    void subscriber.unsubscribe(channel).finally(() => subscriber.disconnect());
  });
});

app.addHook('onClose', async () => {
  await Promise.all([deliveryQueue.close(), monitorQueue.close()]);
  redis.disconnect();
  await database.close();
});

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal(error);
  process.exitCode = 1;
}
