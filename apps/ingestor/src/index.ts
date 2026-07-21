import { setTimeout as wait } from 'node:timers/promises';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { readRuntimeConfig } from '@hooktrials/config';
import { decryptValue, encryptValue, sha256 } from '@hooktrials/crypto';
import {
  attempts,
  createDatabase,
  destinationDeliveries,
  endpoints,
  events,
  incidents,
  scenarios,
} from '@hooktrials/database';
import { createLogger } from '@hooktrials/logger';
import {
  evaluateWebhookContract,
  verifyWebhookSignature,
  type WebhookContract,
} from '@hooktrials/integration-engine';
import { NetworkPolicyError, safeRequest } from '@hooktrials/network-policy';
import {
  builtInScenarios,
  resolveScenarioStep,
  scenarioDefinitionSchema,
} from '@hooktrials/scenario-engine';
import { Queue } from 'bullmq';
import { and, count, eq, gte } from 'drizzle-orm';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';

const config = readRuntimeConfig();
const database = createDatabase(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const analysisQueue = new Queue('event-analysis', { connection: redis });
const deliveryQueue = new Queue('destination-deliveries', { connection: redis });
const alertQueue = new Queue('incident-alerts', { connection: redis });
const app = Fastify({
  loggerInstance: createLogger(config.LOG_LEVEL),
  trustProxy: true,
  bodyLimit: config.MAX_BODY_BYTES,
});

await app.register(helmet, {
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});
const allowedOrigins = new Set([config.APP_ORIGIN]);
if (config.NODE_ENV === 'development') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
  allowedOrigins.add('http://localhost:8080');
  allowedOrigins.add('http://127.0.0.1:8080');
}
await app.register(cors, {
  credentials: false,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: [
    'content-type',
    'x-event-id',
    'x-github-delivery',
    'x-github-event',
    'x-hub-signature-256',
  ],
  exposedHeaders: ['x-hooktrials-event-id', 'retry-after'],
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
});
await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

app.removeAllContentTypeParsers();
app.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

function firstHeader(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function correlationKey(headers: Record<string, string | string[] | undefined>, body: Buffer) {
  const knownHeader =
    firstHeader(headers, 'x-github-delivery') ??
    firstHeader(headers, 'x-event-id') ??
    firstHeader(headers, 'idempotency-key');
  if (knownHeader) return knownHeader.slice(0, 255);

  try {
    const parsed = JSON.parse(body.toString('utf8')) as { id?: unknown };
    if (typeof parsed.id === 'string') return parsed.id.slice(0, 255);
  } catch {
    // Non-JSON payloads are correlated by their body hash.
  }

  return sha256(body);
}

function decryptText(value: string | null): string | null {
  if (!value) return null;
  return decryptValue(value, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8');
}

function decryptContract(value: string | null): WebhookContract | null {
  const text = decryptText(value);
  return text ? (JSON.parse(text) as WebhookContract) : null;
}

function destinationHeaders(
  inbound: Record<string, string | string[] | undefined>,
  encrypted: string | null,
) {
  const blocked = new Set([
    'connection',
    'content-length',
    'host',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]);
  const headers = Object.fromEntries(
    Object.entries(inbound)
      .filter(([key, value]) => {
        const normalized = key.toLowerCase();
        return (
          !blocked.has(normalized) &&
          normalized !== 'via' &&
          !normalized.startsWith('forwarded') &&
          !normalized.startsWith('x-forwarded-') &&
          value !== undefined
        );
      })
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]),
  ) as Record<string, string>;
  const custom = decryptText(encrypted);
  if (custom) Object.assign(headers, JSON.parse(custom) as Record<string, string>);
  return headers;
}

async function openDestinationIncident(
  resourceId: string,
  name: string,
  category: string,
  evidence: Record<string, unknown>,
) {
  const existing = await database.db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.resourceId, resourceId), eq(incidents.status, 'open')))
    .limit(1);
  if (existing[0]) return;
  const created = (
    await database.db
      .insert(incidents)
      .values({
        resourceId,
        cause: category,
        summary: `${name} receives provider traffic, but its destination delivery failed (${category}).`,
        evidence,
      })
      .returning({ id: incidents.id })
  )[0];
  if (created) await enqueueIncidentAlert(created.id, 'opened');
}

async function recoverDestinationIncident(resourceId: string, evidence: Record<string, unknown>) {
  const now = new Date();
  const open = await database.db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.resourceId, resourceId), eq(incidents.status, 'open')));
  await database.db
    .update(incidents)
    .set({ status: 'recovered', recoveredAt: now, updatedAt: now, evidence })
    .where(and(eq(incidents.resourceId, resourceId), eq(incidents.status, 'open')));
  await Promise.all(open.map((incident) => enqueueIncidentAlert(incident.id, 'recovered')));
}

async function enqueueIncidentAlert(incidentId: string, event: 'opened' | 'recovered') {
  await alertQueue.add(
    `incident-${event}`,
    { incidentId, event },
    { jobId: `incident-${incidentId}-${event}`, removeOnComplete: 500, removeOnFail: true },
  );
}

async function openValidationIncident(
  resourceId: string,
  name: string,
  cause: 'signature' | 'contract',
  evidence: Record<string, unknown>,
) {
  const existing = await database.db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.resourceId, resourceId), eq(incidents.status, 'open')))
    .limit(1);
  const summary = `${name}: provider delivery reached HookTrials, but ${cause} validation failed. Destination was not called.`;
  if (existing[0]) {
    await database.db
      .update(incidents)
      .set({ cause, summary, evidence, updatedAt: new Date() })
      .where(eq(incidents.id, existing[0].id));
  } else {
    const created = (
      await database.db
        .insert(incidents)
        .values({ resourceId, cause, summary, evidence })
        .returning({ id: incidents.id })
    )[0];
    if (created) await enqueueIncidentAlert(created.id, 'opened');
  }
}

app.get('/healthz', async () => ({
  service: 'ingestor',
  status: 'ok' as const,
  timestamp: new Date().toISOString(),
}));

async function ingest(request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) {
  const { token } = request.params as { token: string };
  const tokenHash = sha256(token);
  const endpointRows = await database.db
    .select({
      endpointId: endpoints.id,
      resourceId: endpoints.resourceId,
      userId: endpoints.userId,
      active: endpoints.active,
      expiresAt: endpoints.expiresAt,
      name: endpoints.name,
      mode: endpoints.mode,
      encryptedDestinationUrl: endpoints.encryptedDestinationUrl,
      encryptedDestinationHeaders: endpoints.encryptedDestinationHeaders,
      destinationTimeoutMs: endpoints.destinationTimeoutMs,
      encryptedContract: endpoints.encryptedContract,
      signatureProvider: endpoints.signatureProvider,
      encryptedSignatureSecret: endpoints.encryptedSignatureSecret,
      signatureToleranceSeconds: endpoints.signatureToleranceSeconds,
      destinationExpectedMinStatus: endpoints.destinationExpectedMinStatus,
      destinationExpectedMaxStatus: endpoints.destinationExpectedMaxStatus,
      allowPrivateNetworks: endpoints.allowPrivateNetworks,
      allowedPrivateCidrs: endpoints.allowedPrivateCidrs,
      scenarioDefinition: scenarios.definition,
    })
    .from(endpoints)
    .leftJoin(scenarios, eq(endpoints.scenarioId, scenarios.id))
    .where(eq(endpoints.publicTokenHash, tokenHash))
    .limit(1);
  const endpoint = endpointRows[0];

  if (!endpoint || !endpoint.active) return reply.code(404).send({ error: 'endpoint_not_found' });
  if (endpoint.expiresAt && endpoint.expiresAt < new Date()) {
    return reply.code(410).send({ error: 'endpoint_expired' });
  }

  if (config.DAILY_EVENTS_LIMIT > 0) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const dailyUsage = await database.db
      .select({ value: count() })
      .from(attempts)
      .innerJoin(events, eq(attempts.eventId, events.id))
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .where(and(eq(endpoints.userId, endpoint.userId), gte(attempts.receivedAt, startOfDay)));
    if ((dailyUsage[0]?.value ?? 0) >= config.DAILY_EVENTS_LIMIT) {
      return reply
        .code(429)
        .header('retry-after', '86400')
        .send({ error: 'daily_event_limit_reached' });
    }
  }

  const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from('');
  const bodyHash = sha256(body);
  const correlation = correlationKey(request.headers, body);

  let event = (
    await database.db
      .select({ id: events.id })
      .from(events)
      .where(
        and(eq(events.endpointId, endpoint.endpointId), eq(events.correlationKey, correlation)),
      )
      .limit(1)
  )[0];

  if (!event) {
    await database.db
      .insert(events)
      .values({ endpointId: endpoint.endpointId, correlationKey: correlation, bodyHash })
      .onConflictDoNothing();
    event = (
      await database.db
        .select({ id: events.id })
        .from(events)
        .where(
          and(eq(events.endpointId, endpoint.endpointId), eq(events.correlationKey, correlation)),
        )
        .limit(1)
    )[0];
  }
  if (!event) throw new Error('Event creation returned no record');
  await database.db.update(events).set({ lastSeenAt: new Date() }).where(eq(events.id, event.id));

  const attemptCount = await database.db
    .select({ value: count() })
    .from(attempts)
    .where(eq(attempts.eventId, event.id));
  const sequence = Number(attemptCount[0]?.value ?? 0) + 1;
  const scenario = endpoint.scenarioDefinition
    ? scenarioDefinitionSchema.parse(endpoint.scenarioDefinition)
    : builtInScenarios.inspection!;
  const step = resolveScenarioStep(scenario, sequence);
  const observed = endpoint.mode === 'observe';
  const protectedMode = endpoint.mode === 'protect';
  const managed = observed || protectedMode;
  const signatureResult = verifyWebhookSignature({
    provider: endpoint.signatureProvider,
    secret: decryptText(endpoint.encryptedSignatureSecret),
    headers: request.headers,
    body,
    toleranceSeconds: endpoint.signatureToleranceSeconds,
  });
  const contractResult = evaluateWebhookContract({
    method: request.method,
    headers: request.headers,
    body,
    contract: decryptContract(endpoint.encryptedContract),
  });
  const signatureAccepted = ['valid', 'not_configured'].includes(signatureResult.status);
  const validationStatus = !signatureAccepted ? 401 : !contractResult.passed ? 422 : null;

  const inserted = await database.db
    .insert(attempts)
    .values({
      eventId: event.id,
      sequence,
      method: request.method,
      path: request.url,
      headers: request.headers,
      encryptedBody: encryptValue(body, config.PAYLOAD_ENCRYPTION_KEY),
      responseStatus: validationStatus ?? (managed ? 202 : step.statusCode),
      responseDelayMs: managed ? 0 : step.delayMs,
      contractResult,
      signatureProvider: signatureResult.provider,
      signatureStatus: signatureResult.status,
    })
    .returning({ id: attempts.id });
  const attemptId = inserted[0]?.id;
  if (!attemptId) throw new Error('Attempt creation returned no record');

  if (validationStatus) {
    const cause = signatureAccepted ? 'contract' : 'signature';
    if (endpoint.resourceId) {
      await openValidationIncident(endpoint.resourceId, endpoint.name, cause, {
        attemptId,
        signature: signatureResult,
        contract: contractResult,
      });
    }
    await Promise.all([
      redis.publish(
        'hooktrials:endpoint:' + endpoint.endpointId,
        JSON.stringify({ eventId: event.id, attemptId, sequence, statusCode: validationStatus }),
      ),
      analysisQueue.add('analyze-attempt', { eventId: event.id, attemptId }),
    ]);
    return reply.code(validationStatus).send({
      error: cause === 'signature' ? 'signature_verification_failed' : 'contract_validation_failed',
      signatureStatus: signatureResult.status,
      contractFailures: contractResult.checks
        .filter((check) => !check.passed)
        .map((check) => check.message),
    });
  }

  if (managed) {
    const destinationUrl = decryptText(endpoint.encryptedDestinationUrl);
    if (!destinationUrl || !endpoint.resourceId) {
      await database.db
        .update(attempts)
        .set({ responseStatus: 503 })
        .where(eq(attempts.id, attemptId));
      return reply.code(503).send({ error: 'destination_not_configured' });
    }
    const previousDelivery = protectedMode
      ? (
          await database.db
            .select({ id: destinationDeliveries.id })
            .from(destinationDeliveries)
            .where(eq(destinationDeliveries.eventId, event.id))
            .limit(1)
        )[0]
      : null;
    const delivery =
      previousDelivery ??
      (
        await database.db
          .insert(destinationDeliveries)
          .values({
            eventId: event.id,
            inboundAttemptId: attemptId,
            resourceId: endpoint.resourceId,
            state: protectedMode ? 'queued' : 'delivering',
            auditMetadata: protectedMode ? { attemptNumber: 1, automatic: true } : {},
          })
          .returning({ id: destinationDeliveries.id })
      )[0];
    if (!delivery) throw new Error('Destination delivery creation returned no record');

    if (protectedMode) {
      if (!previousDelivery) {
        await deliveryQueue.add(
          'protected-forward',
          { deliveryId: delivery.id },
          { jobId: `delivery-${delivery.id}`, removeOnComplete: 500, removeOnFail: true },
        );
      }
      await Promise.all([
        redis.publish(
          'hooktrials:endpoint:' + endpoint.endpointId,
          JSON.stringify({ eventId: event.id, attemptId, sequence, statusCode: 202 }),
        ),
        analysisQueue.add('analyze-attempt', { eventId: event.id, attemptId }),
      ]);
      return reply
        .code(202)
        .header('x-hooktrials-event-id', event.id)
        .send({
          accepted: true,
          eventId: event.id,
          delivery: previousDelivery ? 'duplicate' : 'queued',
        });
    }

    try {
      const supportedMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
      if (!supportedMethods.has(request.method)) {
        throw new NetworkPolicyError('blocked', `Unsupported forwarding method: ${request.method}`);
      }
      const result = await safeRequest(destinationUrl, {
        allowHttp: config.DEPLOYMENT_MODE === 'selfhost' && endpoint.allowPrivateNetworks,
        allowPrivateNetworks:
          config.DEPLOYMENT_MODE === 'selfhost' && endpoint.allowPrivateNetworks,
        allowedPrivateCidrs: endpoint.allowedPrivateCidrs as string[],
        method: request.method as 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        headers: destinationHeaders(request.headers, endpoint.encryptedDestinationHeaders),
        body,
        timeoutMs: endpoint.destinationTimeoutMs,
        maxResponseBytes: 65_536,
      });
      const succeeded =
        result.statusCode >= endpoint.destinationExpectedMinStatus &&
        result.statusCode <= endpoint.destinationExpectedMaxStatus;
      const completedAt = new Date();
      await Promise.all([
        database.db
          .update(destinationDeliveries)
          .set({
            state: succeeded ? 'succeeded' : 'failed',
            statusCode: result.statusCode,
            latencyMs: result.latencyMs,
            responseBytes: result.body.length,
            errorCategory: succeeded ? null : 'http',
            errorMessage: succeeded ? null : `Destination returned HTTP ${result.statusCode}`,
            completedAt,
          })
          .where(eq(destinationDeliveries.id, delivery.id)),
        database.db
          .update(attempts)
          .set({ responseStatus: result.statusCode, responseDelayMs: result.latencyMs })
          .where(eq(attempts.id, attemptId)),
        succeeded
          ? recoverDestinationIncident(endpoint.resourceId, {
              deliveryId: delivery.id,
              statusCode: result.statusCode,
              recoveredAt: completedAt,
            })
          : openDestinationIncident(endpoint.resourceId, endpoint.name, 'http', {
              deliveryId: delivery.id,
              statusCode: result.statusCode,
              observedAt: completedAt,
            }),
      ]);
      await Promise.all([
        redis.publish(
          'hooktrials:endpoint:' + endpoint.endpointId,
          JSON.stringify({ eventId: event.id, attemptId, sequence, statusCode: result.statusCode }),
        ),
        analysisQueue.add('analyze-attempt', { eventId: event.id, attemptId }),
      ]);
      for (const name of ['content-type', 'retry-after']) {
        const value = result.headers[name];
        if (value) reply.header(name, value);
      }
      return reply.code(result.statusCode).send(result.body);
    } catch (error) {
      const failure =
        error instanceof NetworkPolicyError
          ? error
          : new NetworkPolicyError(
              'connect',
              error instanceof Error ? error.message : 'Destination delivery failed',
            );
      const statusCode = failure.category === 'timeout' ? 504 : 502;
      const completedAt = new Date();
      await Promise.all([
        database.db
          .update(destinationDeliveries)
          .set({
            state: 'failed',
            errorCategory: failure.category,
            errorMessage: failure.message.slice(0, 512),
            completedAt,
          })
          .where(eq(destinationDeliveries.id, delivery.id)),
        database.db
          .update(attempts)
          .set({ responseStatus: statusCode })
          .where(eq(attempts.id, attemptId)),
        openDestinationIncident(endpoint.resourceId, endpoint.name, failure.category, {
          deliveryId: delivery.id,
          observedAt: completedAt,
        }),
      ]);
      await redis.publish(
        'hooktrials:endpoint:' + endpoint.endpointId,
        JSON.stringify({ eventId: event.id, attemptId, sequence, statusCode }),
      );
      return reply.code(statusCode).send({
        error: 'destination_delivery_failed',
        category: failure.category,
      });
    }
  }

  await Promise.all([
    redis.publish(
      'hooktrials:endpoint:' + endpoint.endpointId,
      JSON.stringify({
        eventId: event.id,
        attemptId,
        sequence,
        statusCode: step.statusCode,
      }),
    ),
    analysisQueue.add('analyze-attempt', { eventId: event.id, attemptId }),
  ]);

  if (step.delayMs > 0) await wait(step.delayMs);
  for (const [name, value] of Object.entries(step.headers)) reply.header(name, value);
  return reply.code(step.statusCode).send(step.body ?? '');
}

app.all('/i/:token', ingest);
app.all('/i/:token/*', ingest);

app.addHook('onClose', async () => {
  await alertQueue.close();
  await deliveryQueue.close();
  await analysisQueue.close();
  redis.disconnect();
  await database.close();
});

try {
  await app.listen({ host: config.INGEST_HOST, port: config.INGEST_PORT });
} catch (error) {
  app.log.fatal(error);
  process.exitCode = 1;
}
