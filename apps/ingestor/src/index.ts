import { setTimeout as wait } from 'node:timers/promises';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { readRuntimeConfig } from '@hooktrials/config';
import { encryptValue, sha256 } from '@hooktrials/crypto';
import { attempts, createDatabase, endpoints, events, scenarios } from '@hooktrials/database';
import { createLogger } from '@hooktrials/logger';
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
const app = Fastify({
  loggerInstance: createLogger(config.LOG_LEVEL),
  trustProxy: true,
  bodyLimit: config.MAX_BODY_BYTES,
});

await app.register(helmet);
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
      userId: endpoints.userId,
      active: endpoints.active,
      expiresAt: endpoints.expiresAt,
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

  const inserted = await database.db
    .insert(attempts)
    .values({
      eventId: event.id,
      sequence,
      method: request.method,
      path: request.url,
      headers: request.headers,
      encryptedBody: encryptValue(body, config.PAYLOAD_ENCRYPTION_KEY),
      responseStatus: step.statusCode,
      responseDelayMs: step.delayMs,
    })
    .returning({ id: attempts.id });

  await Promise.all([
    redis.publish(
      'hooktrials:endpoint:' + endpoint.endpointId,
      JSON.stringify({
        eventId: event.id,
        attemptId: inserted[0]?.id,
        sequence,
        statusCode: step.statusCode,
      }),
    ),
    analysisQueue.add('analyze-attempt', { eventId: event.id, attemptId: inserted[0]?.id }),
  ]);

  if (step.delayMs > 0) await wait(step.delayMs);
  for (const [name, value] of Object.entries(step.headers)) reply.header(name, value);
  return reply.code(step.statusCode).send(step.body ?? '');
}

app.all('/i/:token', ingest);
app.all('/i/:token/*', ingest);

app.addHook('onClose', async () => {
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
