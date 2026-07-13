import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { readRuntimeConfig } from '@hooktrials/config';
import {
  createEndpointInputSchema,
  loginInputSchema,
  registerInputSchema,
  scenarioInputSchema,
  updateEndpointInputSchema,
} from '@hooktrials/contracts';
import { decryptValue, encryptValue, sha256 } from '@hooktrials/crypto';
import {
  attempts,
  createDatabase,
  endpoints,
  events,
  reports,
  scenarios,
  users,
} from '@hooktrials/database';
import { createLogger } from '@hooktrials/logger';
import { builtInScenarios } from '@hooktrials/scenario-engine';
import argon2 from 'argon2';
import { and, count, desc, eq, or, sql } from 'drizzle-orm';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import { nanoid } from 'nanoid';
import { ZodError } from 'zod';
import { clearSession, createSession, getAuthenticatedUser, setSessionCookie } from './auth.js';

const config = readRuntimeConfig();
const logger = createLogger(config.LOG_LEVEL);
const database = createDatabase(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

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

const app = Fastify({ loggerInstance: logger, trustProxy: true });
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
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
});
await app.register(helmet);
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: 'validation_error', issues: error.issues });
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

async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const user = await getAuthenticatedUser(database.db, request);
  if (!user) {
    await reply.code(401).send({ error: 'authentication_required' });
    return null;
  }
  return user;
}

function decryptToken(value: string | null): string | null {
  if (!value) return null;
  try {
    return decryptValue(value, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8');
  } catch {
    return null;
  }
}

function safeHeaders(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const sensitive = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'proxy-authorization',
  ]);
  return Object.fromEntries(
    Object.entries(value).map(([key, headerValue]) => [
      key,
      sensitive.has(key.toLowerCase()) ? '[redacted]' : headerValue,
    ]),
  );
}

app.get('/healthz', async () => ({
  service: 'api',
  status: 'ok' as const,
  timestamp: new Date().toISOString(),
}));

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
    externalAccess: !['localhost', '127.0.0.1', '::1'].includes(
      new URL(config.APP_ORIGIN).hostname,
    ),
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
          })
          .returning({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            role: users.role,
          });
        return created[0] ?? null;
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.message === 'registration_closed')
          return 'closed' as const;
        throw error;
      });

    if (user === 'closed') return reply.code(403).send({ error: 'registration_closed' });
    if (!user) return reply.code(409).send({ error: 'email_already_registered' });
    if (!user) throw new Error('User creation returned no record');

    const session = await createSession(database.db, user.id);
    setSessionCookie(reply, session.token, session.expiresAt, config.COOKIE_SECURE);
    return reply.code(201).send({ user });
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

    const session = await createSession(database.db, user.id);
    setSessionCookie(reply, session.token, session.expiresAt, config.COOKIE_SECURE);
    return {
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    };
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
    .where(or(eq(scenarios.builtIn, true), eq(scenarios.userId, user.id)))
    .orderBy(desc(scenarios.builtIn), scenarios.name);
  return { scenarios: items };
});

app.post('/v1/scenarios', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = scenarioInputSchema.parse(request.body);
  const definition = { name: input.name, steps: input.steps, repeatLastStep: input.repeatLastStep };
  const created = await database.db
    .insert(scenarios)
    .values({ userId: user.id, name: input.name, definition })
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
    .where(and(eq(scenarios.id, id), eq(scenarios.userId, user.id), eq(scenarios.builtIn, false)))
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
    .where(and(eq(endpoints.userId, user.id), eq(endpoints.scenarioId, id)));
  if ((usage[0]?.value ?? 0) > 0) return reply.code(409).send({ error: 'scenario_in_use' });
  const removed = await database.db
    .delete(scenarios)
    .where(and(eq(scenarios.id, id), eq(scenarios.userId, user.id), eq(scenarios.builtIn, false)))
    .returning({ id: scenarios.id });
  if (!removed[0]) return reply.code(404).send({ error: 'scenario_not_found' });
  return reply.code(204).send();
});

app.get('/v1/endpoints', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const items = await database.db
    .select({
      id: endpoints.id,
      name: endpoints.name,
      tokenPrefix: endpoints.publicTokenPrefix,
      encryptedToken: endpoints.encryptedToken,
      active: endpoints.active,
      scenarioId: endpoints.scenarioId,
      scenarioName: scenarios.name,
      createdAt: endpoints.createdAt,
      expiresAt: endpoints.expiresAt,
    })
    .from(endpoints)
    .leftJoin(scenarios, eq(endpoints.scenarioId, scenarios.id))
    .where(eq(endpoints.userId, user.id))
    .orderBy(desc(endpoints.createdAt));

  return {
    endpoints: items.map(({ encryptedToken, ...item }) => {
      const token = decryptToken(encryptedToken);
      return { ...item, ingestUrl: token ? `${config.INGEST_ORIGIN}/i/${token}` : null };
    }),
    limits: { endpoints: config.ENDPOINTS_LIMIT, dailyEvents: config.DAILY_EVENTS_LIMIT },
  };
});

app.post('/v1/endpoints', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const input = createEndpointInputSchema.parse(request.body);
  const existing = await database.db
    .select({ value: count() })
    .from(endpoints)
    .where(eq(endpoints.userId, user.id));
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
        or(eq(scenarios.builtIn, true), eq(scenarios.userId, user.id)),
      ),
    )
    .limit(1);
  if (!allowedScenario[0]) return reply.code(400).send({ error: 'invalid_scenario' });

  const publicToken = `ht_${nanoid(32)}`;
  const created = await database.db
    .insert(endpoints)
    .values({
      userId: user.id,
      scenarioId,
      name: input.name,
      publicTokenHash: sha256(publicToken),
      publicTokenPrefix: publicToken.slice(0, 12),
      encryptedToken: encryptValue(publicToken, config.PAYLOAD_ENCRYPTION_KEY),
    })
    .returning({ id: endpoints.id, name: endpoints.name, createdAt: endpoints.createdAt });

  return reply.code(201).send({
    endpoint: {
      ...created[0],
      tokenPrefix: publicToken.slice(0, 12),
      scenarioId,
      scenarioName: allowedScenario[0].name,
      active: true,
      ingestUrl: `${config.INGEST_ORIGIN}/i/${publicToken}`,
    },
  });
});

app.patch('/v1/endpoints/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const input = updateEndpointInputSchema.parse(request.body);

  if (input.scenarioId) {
    const allowed = await database.db
      .select({ id: scenarios.id })
      .from(scenarios)
      .where(
        and(
          eq(scenarios.id, input.scenarioId),
          or(eq(scenarios.builtIn, true), eq(scenarios.userId, user.id)),
        ),
      )
      .limit(1);
    if (!allowed[0]) return reply.code(400).send({ error: 'invalid_scenario' });
  }

  const updated = await database.db
    .update(endpoints)
    .set(input)
    .where(and(eq(endpoints.id, id), eq(endpoints.userId, user.id)))
    .returning({
      id: endpoints.id,
      name: endpoints.name,
      active: endpoints.active,
      scenarioId: endpoints.scenarioId,
    });
  if (!updated[0]) return reply.code(404).send({ error: 'endpoint_not_found' });
  return { endpoint: updated[0] };
});

app.delete('/v1/endpoints/:id', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const removed = await database.db
    .delete(endpoints)
    .where(and(eq(endpoints.id, id), eq(endpoints.userId, user.id)))
    .returning({ id: endpoints.id });
  if (!removed[0]) return reply.code(404).send({ error: 'endpoint_not_found' });
  return reply.code(204).send();
});

app.get('/v1/endpoints/:id/events', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = await database.db
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.id, id), eq(endpoints.userId, user.id)))
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
          sequence: attempts.sequence,
          statusCode: attempts.responseStatus,
          receivedAt: attempts.receivedAt,
        })
        .from(attempts)
        .where(eq(attempts.eventId, event.id))
        .orderBy(attempts.sequence);
      return { ...event, attempts: attemptRows };
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
    })
    .from(events)
    .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
    .where(and(eq(events.id, id), eq(endpoints.userId, user.id)))
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
  return {
    event: {
      ...event,
      attempts: attemptRows.map(({ encryptedBody, headers, ...attempt }) => {
        const body = decryptValue(encryptedBody, config.PAYLOAD_ENCRYPTION_KEY);
        return {
          ...attempt,
          headers: safeHeaders(headers),
          body: body.toString('utf8'),
          bodyBase64: body.toString('base64'),
        };
      }),
      report: report ?? null,
    },
  };
});

app.get('/v1/endpoints/:id/stream', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return;
  const { id } = request.params as { id: string };
  const owned = await database.db
    .select({ id: endpoints.id })
    .from(endpoints)
    .where(and(eq(endpoints.id, id), eq(endpoints.userId, user.id)))
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
  redis.disconnect();
  await database.close();
});

try {
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  app.log.fatal(error);
  process.exitCode = 1;
}
