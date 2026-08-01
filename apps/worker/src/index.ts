import { readRuntimeConfig } from '@hooktrials/config';
import { decryptValue, encryptValue, sha256 } from '@hooktrials/crypto';
import {
  computeBackoff,
  idempotencyKey,
  nextFailoverIndex,
  parseRetryAfter,
  retriesExhausted,
} from '@hooktrials/delivery-engine';
import {
  attempts,
  alertChannels,
  alertDeliveries,
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
} from '@hooktrials/database';
import { createLogger, isBlockedForwardHeaderName } from '@hooktrials/logger';
import {
  buildIncidentAlertPayload,
  calculateWebhookScore,
  incidentAlertScope,
  shouldDeliverIncidentAlert,
} from '@hooktrials/integration-engine';
import {
  deriveMonitorState,
  evaluateContract,
  outcomeFromContract,
} from '@hooktrials/monitor-engine';
import { NetworkPolicyError, safeIcmpProbe, safeRequest } from '@hooktrials/network-policy';
import { Queue, Worker } from 'bullmq';
import { and, asc, eq, gte, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { Redis } from 'ioredis';

const config = readRuntimeConfig();
const logger = createLogger(config.LOG_LEVEL);
const database = createDatabase(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const monitorQueue = new Queue('monitor-checks', { connection: redis });
const deliveryQueue = new Queue('destination-deliveries', { connection: redis });
const alertQueue = new Queue('incident-alerts', { connection: redis });

const MONITOR_LOCK_MS = 60_000;
const MONITOR_USER_CONCURRENCY = 2;
const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function acquireMonitorSlot(
  keys: string[],
  token: string,
  waitForAvailable: boolean,
): Promise<(() => Promise<void>) | null> {
  do {
    for (const key of keys) {
      const acquired = await redis.set(key, token, 'PX', MONITOR_LOCK_MS, 'NX');
      if (acquired !== 'OK') continue;
      return async () => {
        await redis.eval(
          `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`,
          1,
          key,
          token,
        );
      };
    }
    if (waitForAvailable) await wait(100);
  } while (waitForAvailable);
  return null;
}

async function analyzeEvent(eventId: string) {
  const rows = await database.db
    .select()
    .from(attempts)
    .where(eq(attempts.eventId, eventId))
    .orderBy(asc(attempts.sequence));
  if (rows.length === 0) return;

  const hashes = rows.map((attempt) =>
    sha256(decryptValue(attempt.encryptedBody, config.PAYLOAD_ENCRYPTION_KEY)),
  );
  const payloadStable = hashes.every((hash) => hash === hashes[0]);
  const lastAttempt = rows.at(-1)!;
  const deliveryRows = await database.db
    .select()
    .from(destinationDeliveries)
    .where(eq(destinationDeliveries.eventId, eventId))
    .orderBy(destinationDeliveries.sequence);
  const finalDeliveries = new Map<string, (typeof deliveryRows)[number]>();
  let hasFailover = false;
  for (const delivery of deliveryRows) {
    const metadata = delivery.auditMetadata as { destinationId?: unknown; strategy?: unknown };
    const destinationKey =
      typeof metadata.destinationId === 'string' ? metadata.destinationId : 'primary';
    if (metadata.strategy === 'failover') hasFailover = true;
    finalDeliveries.set(destinationKey, delivery);
  }
  const finalDeliveryRows = [...finalDeliveries.values()];
  const hasPendingDelivery = finalDeliveryRows.some((delivery) =>
    ['queued', 'retrying', 'delivering'].includes(delivery.state),
  );
  const hasDeadLetter = finalDeliveryRows.some((delivery) => delivery.state === 'dead_letter');
  const recovered = finalDeliveryRows.length
    ? !hasPendingDelivery &&
      !hasDeadLetter &&
      (hasFailover
        ? finalDeliveryRows.some((delivery) => delivery.state === 'succeeded')
        : finalDeliveryRows.every((delivery) => delivery.state === 'succeeded'))
    : lastAttempt.responseStatus >= 200 && lastAttempt.responseStatus < 300;
  const retryObserved = deliveryRows.length > 1 || rows.length > 1;
  const invalidSignatures = rows.filter((attempt) =>
    ['invalid', 'missing', 'stale'].includes(attempt.signatureStatus),
  ).length;
  const contractFailures = rows.filter((attempt) => {
    const contract = attempt.contractResult as { configured?: boolean; passed?: boolean };
    return contract.configured === true && contract.passed === false;
  }).length;
  const scored = calculateWebhookScore({
    deliveries: deliveryRows.length,
    failedDeliveries: deliveryRows.filter((delivery) =>
      ['failed', 'retrying', 'dead_letter'].includes(delivery.state),
    ).length,
    retries: deliveryRows.filter((delivery) => delivery.kind === 'retry').length,
    deadLetters: deliveryRows.filter((delivery) => delivery.state === 'dead_letter').length,
    invalidSignatures,
    contractFailures,
    inboundAttempts: rows.length,
    openIncident: false,
  });
  const result = {
    attemptCount: rows.length,
    recovered,
    payloadStable,
    retryObserved,
    providerStatuses: rows.map((attempt) => attempt.responseStatus),
    destinationStatuses: deliveryRows.map((delivery) => delivery.statusCode),
    signatures: rows.map((attempt) => attempt.signatureStatus),
    contractsPassed: contractFailures === 0,
    deductions: scored.deductions,
    analyzedAt: new Date().toISOString(),
  };
  const passed = recovered && payloadStable && invalidSignatures === 0 && contractFailures === 0;

  await database.db
    .insert(reports)
    .values({
      eventId,
      status: passed ? 'passed' : recovered ? 'failed' : 'pending',
      score: scored.score,
      result,
      completedAt: recovered ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: reports.eventId,
      set: {
        status: passed ? 'passed' : recovered ? 'failed' : 'pending',
        score: scored.score,
        result,
        completedAt: recovered ? new Date() : null,
      },
    });
}

async function cleanupExpiredData() {
  const cutoff = new Date(Date.now() - config.EVENT_RETENTION_HOURS * 60 * 60 * 1_000);
  const removedEvents = await database.db
    .delete(events)
    .where(lt(events.lastSeenAt, cutoff))
    .returning({ id: events.id });
  await database.db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await database.db.delete(monitorChecks).where(lt(monitorChecks.startedAt, cutoff));
  if (removedEvents.length > 0) {
    logger.info({ count: removedEvents.length }, 'Expired events removed');
  }
}

const analysisWorker = new Worker(
  'event-analysis',
  async (job) => {
    if (typeof job.data.eventId !== 'string') throw new Error('Missing eventId');
    await analyzeEvent(job.data.eventId);
  },
  { connection: redis, concurrency: 4 },
);

analysisWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Analysis job failed');
});

function decryptedHeaders(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(
      decryptValue(value, config.PAYLOAD_ENCRYPTION_KEY).toString('utf8'),
    ) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    logger.warn('Unable to decrypt captured request headers; forwarding without them');
    return {};
  }
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

function forwardingHeaders(
  encryptedValue: string | null,
  fallbackValue: unknown,
  encryptedCustom: string | null,
  deliveryContext: {
    eventId: string;
    deliveryId: string;
    attempt: number;
    idempotencyKey?: string;
  },
): Record<string, string> {
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
    'via',
  ]);
  const decrypted = decryptedHeaders(encryptedValue);
  const inbound =
    Object.keys(decrypted).length > 0
      ? decrypted
      : fallbackValue && typeof fallbackValue === 'object' && !Array.isArray(fallbackValue)
        ? (fallbackValue as Record<string, unknown>)
        : {};
  const headers = Object.fromEntries(
    Object.entries(inbound)
      .filter(([key, headerValue]) => {
        const normalized = key.toLowerCase();
        return (
          !blocked.has(normalized) &&
          !isBlockedForwardHeaderName(normalized) &&
          !normalized.startsWith('forwarded') &&
          !normalized.startsWith('x-forwarded-') &&
          typeof headerValue === 'string'
        );
      })
      .map(([key, headerValue]) => [key, headerValue as string]),
  );
  return {
    ...headers,
    ...parseHeaders(encryptedCustom),
    // Custom headers cannot override the delivery identity used for
    // idempotency and audit correlation downstream.
    'x-hooktrials-event-id': deliveryContext.eventId,
    'x-hooktrials-delivery-id': deliveryContext.deliveryId,
    'x-hooktrials-delivery-attempt': String(deliveryContext.attempt),
    ...(deliveryContext.idempotencyKey
      ? { 'x-hooktrials-idempotency-key': deliveryContext.idempotencyKey }
      : {}),
  };
}

const destinationLocks = new Map<string, Promise<void>>();

async function withDestinationLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = destinationLocks.get(key) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => gate);
  destinationLocks.set(key, chain);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (destinationLocks.get(key) === chain) destinationLocks.delete(key);
  }
}

async function updateDeliveryIncident(
  resourceId: string,
  name: string,
  cause: string,
  summary: string,
  evidence: Record<string, unknown>,
) {
  const open = (
    await database.db
      .select({ id: incidents.id })
      .from(incidents)
      .where(and(eq(incidents.resourceId, resourceId), eq(incidents.status, 'open')))
      .limit(1)
  )[0];
  if (open) {
    await database.db
      .update(incidents)
      .set({ cause, summary, evidence, updatedAt: new Date() })
      .where(eq(incidents.id, open.id));
  } else {
    const created = (
      await database.db
        .insert(incidents)
        .values({ resourceId, cause, summary: `${name}: ${summary}`, evidence })
        .returning({ id: incidents.id })
    )[0];
    if (created) await enqueueIncidentAlert(created.id, 'opened');
  }
}

async function recoverDeliveryIncident(resourceId: string, evidence: Record<string, unknown>) {
  const now = new Date();
  const open = await database.db
    .select({ id: incidents.id })
    .from(incidents)
    .where(and(eq(incidents.resourceId, resourceId), eq(incidents.status, 'open')));
  await database.db
    .update(incidents)
    .set({
      status: 'recovered',
      summary: 'Destination recovered. Protected event delivered successfully with no data loss.',
      recoveredAt: now,
      updatedAt: now,
      evidence,
    })
    .where(and(eq(incidents.resourceId, resourceId), eq(incidents.status, 'open')));
  await Promise.all(open.map((incident) => enqueueIncidentAlert(incident.id, 'recovered')));
}

async function performDestinationDelivery(deliveryId: string) {
  const row = (
    await database.db
      .select({
        delivery: destinationDeliveries,
        attempt: attempts,
        endpoint: endpoints,
        resourceName: integrationResources.name,
      })
      .from(destinationDeliveries)
      .innerJoin(attempts, eq(destinationDeliveries.inboundAttemptId, attempts.id))
      .innerJoin(events, eq(destinationDeliveries.eventId, events.id))
      .innerJoin(endpoints, eq(events.endpointId, endpoints.id))
      .innerJoin(
        integrationResources,
        eq(destinationDeliveries.resourceId, integrationResources.id),
      )
      .where(eq(destinationDeliveries.id, deliveryId))
      .limit(1)
  )[0];
  if (!row || !['queued', 'retrying', 'delivering'].includes(row.delivery.state)) return;
  if (row.endpoint.mode !== 'protect' && row.delivery.kind === 'forward') return;

  const storedPolicy = decryptDeliveryPolicy(row.endpoint.encryptedDeliveryPolicy);
  const legacyUrl = row.endpoint.encryptedDestinationUrl
    ? decryptValue(row.endpoint.encryptedDestinationUrl, config.PAYLOAD_ENCRYPTION_KEY).toString(
        'utf8',
      )
    : null;
  const policy: StoredDeliveryPolicy = storedPolicy ?? {
    strategy: 'single',
    idempotencyScope: row.endpoint.idempotencyScope,
    destinations: legacyUrl
      ? [
          {
            id: 'primary',
            name: 'Primary destination',
            url: legacyUrl,
            headers: {},
            timeoutMs: row.endpoint.destinationTimeoutMs,
            expectedMinStatus: row.endpoint.destinationExpectedMinStatus,
            expectedMaxStatus: row.endpoint.destinationExpectedMaxStatus,
            active: true,
          },
        ]
      : [],
  };
  const metadata = row.delivery.auditMetadata as {
    attemptNumber?: number;
    destinationId?: string;
    destinationIndex?: number;
    idempotencyKey?: string;
  };
  const destinationIndex = Number(metadata.destinationIndex ?? 0);
  const destination =
    policy.destinations.find((item) => item.id === metadata.destinationId) ??
    policy.destinations[destinationIndex] ??
    policy.destinations[0];
  if (!destination) return;

  await withDestinationLock(`${row.endpoint.id}:${destination.id}`, async () => {
    const startedAt = new Date();
    await database.db
      .update(destinationDeliveries)
      .set({ state: 'delivering', startedAt })
      .where(eq(destinationDeliveries.id, deliveryId));
    const attemptNumber = Math.max(1, Number(metadata.attemptNumber ?? 1));
    let failureCategory = 'connect';
    let failureMessage = 'Destination delivery failed';
    let statusCode: number | null = null;
    let latencyMs: number | null = null;
    let responseBytes = 0;
    let retryDelay: number | null = null;
    let failoverTriggered = false;

    try {
      const url = destination.url;
      const supportedMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']);
      if (!supportedMethods.has(row.attempt.method)) {
        throw new NetworkPolicyError(
          'blocked',
          `Unsupported forwarding method: ${row.attempt.method}`,
        );
      }
      const response = await safeRequest(url, {
        method: row.attempt.method as 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        headers: forwardingHeaders(
          row.attempt.encryptedHeaders,
          row.attempt.headers,
          destination.headers && Object.keys(destination.headers).length > 0
            ? encryptValue(JSON.stringify(destination.headers), config.PAYLOAD_ENCRYPTION_KEY)
            : row.endpoint.encryptedDestinationHeaders,
          {
            eventId: row.delivery.eventId,
            deliveryId,
            attempt: attemptNumber,
            idempotencyKey:
              metadata.idempotencyKey ??
              idempotencyKey(row.delivery.eventId, destination.id, policy.idempotencyScope, sha256),
          },
        ),
        body: decryptValue(row.attempt.encryptedBody, config.PAYLOAD_ENCRYPTION_KEY),
        timeoutMs: destination.timeoutMs,
        maxResponseBytes: 65_536,
        allowHttp: config.DEPLOYMENT_MODE === 'selfhost' && row.endpoint.allowPrivateNetworks,
        allowPrivateNetworks:
          config.DEPLOYMENT_MODE === 'selfhost' && row.endpoint.allowPrivateNetworks,
        allowedPrivateCidrs: row.endpoint.allowedPrivateCidrs as string[],
      });
      statusCode = response.statusCode;
      latencyMs = response.latencyMs;
      responseBytes = response.body.length;
      if (
        statusCode >= destination.expectedMinStatus &&
        statusCode <= destination.expectedMaxStatus
      ) {
        const completedAt = new Date();
        await database.db
          .update(destinationDeliveries)
          .set({
            state: 'succeeded',
            statusCode,
            latencyMs,
            responseBytes,
            nextAttemptAt: null,
            completedAt,
          })
          .where(eq(destinationDeliveries.id, deliveryId));
        await recoverDeliveryIncident(row.delivery.resourceId, {
          deliveryId,
          statusCode,
          latencyMs,
          recoveredAt: completedAt,
        });
        await redis.publish(
          'hooktrials:endpoint:' + row.endpoint.id,
          JSON.stringify({ eventId: row.delivery.eventId, deliveryId, state: 'succeeded' }),
        );
        await analyzeEvent(row.delivery.eventId);
        return;
      }
      failureCategory = 'http';
      failureMessage = `Destination returned HTTP ${statusCode}`;
      retryDelay = parseRetryAfter(response.headers['retry-after'], row.endpoint.retryMaxDelayMs);
    } catch (error) {
      failureCategory = error instanceof NetworkPolicyError ? error.category : 'connect';
      failureMessage = error instanceof Error ? error.message : failureMessage;
    }

    const exhausted = retriesExhausted(attemptNumber, row.endpoint.retryMaxAttempts);
    const completedAt = new Date();
    if (exhausted) {
      let nextIndex = nextFailoverIndex(
        policy.strategy,
        destinationIndex,
        policy.destinations.length,
      );
      while (nextIndex !== null && !policy.destinations[nextIndex]?.active) {
        nextIndex = nextFailoverIndex(policy.strategy, nextIndex, policy.destinations.length);
      }
      if (nextIndex !== null) {
        failoverTriggered = true;
        const nextDestination = policy.destinations[nextIndex]!;
        const sequenceRows = await database.db
          .select({ value: sql<number>`coalesce(max(${destinationDeliveries.sequence}), 0)` })
          .from(destinationDeliveries)
          .where(eq(destinationDeliveries.eventId, row.delivery.eventId));
        const next = await database.db.transaction(async (tx) => {
          await tx
            .update(destinationDeliveries)
            .set({
              state: 'failed',
              statusCode,
              latencyMs,
              responseBytes,
              errorCategory: failureCategory,
              errorMessage: failureMessage.slice(0, 512),
              completedAt,
              auditMetadata: { ...metadata, failoverTo: nextDestination.id },
            })
            .where(eq(destinationDeliveries.id, deliveryId));
          return (
            await tx
              .insert(destinationDeliveries)
              .values({
                eventId: row.delivery.eventId,
                inboundAttemptId: row.delivery.inboundAttemptId,
                resourceId: row.delivery.resourceId,
                sequence: Number(sequenceRows[0]?.value ?? 0) + 1,
                kind: 'failover',
                state: 'queued',
                replayOfDeliveryId: deliveryId,
                auditMetadata: {
                  attemptNumber: 1,
                  automatic: true,
                  strategy: 'failover',
                  destinationIndex: nextIndex,
                  destinationId: nextDestination.id,
                  destinationName: nextDestination.name,
                  idempotencyKey: idempotencyKey(
                    row.delivery.eventId,
                    nextDestination.id,
                    policy.idempotencyScope,
                    sha256,
                  ),
                },
              })
              .returning({ id: destinationDeliveries.id })
          )[0];
        });
        if (!next) throw new Error('Failover delivery creation returned no record');
        await deliveryQueue.add(
          'automatic-failover',
          { deliveryId: next.id },
          { jobId: `delivery-${next.id}`, removeOnComplete: 500, removeOnFail: true },
        );
        await updateDeliveryIncident(
          row.delivery.resourceId,
          row.resourceName,
          failureCategory,
          `primary destination exhausted ${attemptNumber} attempts; delivery failed over to ${nextDestination.name}.`,
          {
            deliveryId,
            statusCode,
            attemptNumber,
            state: 'failed',
            failoverTo: nextDestination.id,
          },
        );
      } else {
        await database.db
          .update(destinationDeliveries)
          .set({
            state: 'dead_letter',
            statusCode,
            latencyMs,
            responseBytes,
            errorCategory: failureCategory,
            errorMessage: failureMessage.slice(0, 512),
            completedAt,
          })
          .where(eq(destinationDeliveries.id, deliveryId));
        await updateDeliveryIncident(
          row.delivery.resourceId,
          row.resourceName,
          failureCategory,
          `delivery exhausted ${attemptNumber} attempts and entered dead-letter. No event was lost.`,
          { deliveryId, statusCode, attemptNumber, state: 'dead_letter' },
        );
      }
    } else {
      const delay =
        retryDelay ??
        computeBackoff(attemptNumber, row.endpoint.retryBaseDelayMs, row.endpoint.retryMaxDelayMs);
      const nextAttemptAt = new Date(Date.now() + delay);
      const sequenceRows = await database.db
        .select({ value: sql<number>`coalesce(max(${destinationDeliveries.sequence}), 0)` })
        .from(destinationDeliveries)
        .where(eq(destinationDeliveries.eventId, row.delivery.eventId));
      const next = await database.db.transaction(async (tx) => {
        await tx
          .update(destinationDeliveries)
          .set({
            state: 'retrying',
            statusCode,
            latencyMs,
            responseBytes,
            errorCategory: failureCategory,
            errorMessage: failureMessage.slice(0, 512),
            nextAttemptAt,
            completedAt,
          })
          .where(eq(destinationDeliveries.id, deliveryId));
        return (
          await tx
            .insert(destinationDeliveries)
            .values({
              eventId: row.delivery.eventId,
              inboundAttemptId: row.delivery.inboundAttemptId,
              resourceId: row.delivery.resourceId,
              sequence: Number(sequenceRows[0]?.value ?? 0) + 1,
              kind: 'retry',
              state: 'queued',
              nextAttemptAt,
              replayOfDeliveryId: deliveryId,
              auditMetadata: {
                ...metadata,
                attemptNumber: attemptNumber + 1,
                automatic: true,
              },
            })
            .returning({ id: destinationDeliveries.id })
        )[0];
      });
      if (!next) throw new Error('Retry delivery creation returned no record');
      await deliveryQueue.add(
        'automatic-retry',
        { deliveryId: next.id },
        { jobId: `delivery-${next.id}`, delay, removeOnComplete: 500, removeOnFail: true },
      );
      await updateDeliveryIncident(
        row.delivery.resourceId,
        row.resourceName,
        failureCategory,
        `destination failed; retry ${attemptNumber + 1}/${row.endpoint.retryMaxAttempts} scheduled in ${delay} ms. Event is protected.`,
        { deliveryId, statusCode, attemptNumber, nextAttemptAt },
      );
    }
    await redis.publish(
      'hooktrials:endpoint:' + row.endpoint.id,
      JSON.stringify({
        eventId: row.delivery.eventId,
        deliveryId,
        state: failoverTriggered ? 'failover' : exhausted ? 'dead_letter' : 'retrying',
      }),
    );
    await analyzeEvent(row.delivery.eventId);
  });
}

const deliveryWorker = new Worker(
  'destination-deliveries',
  async (job) => {
    if (typeof job.data.deliveryId !== 'string') throw new Error('Missing deliveryId');
    await performDestinationDelivery(job.data.deliveryId);
  },
  { connection: redis, concurrency: 4 },
);

deliveryWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Destination delivery job failed');
  if (typeof job?.data.deliveryId === 'string') {
    void database.db
      .update(destinationDeliveries)
      .set({ state: 'queued' })
      .where(eq(destinationDeliveries.id, job.data.deliveryId));
  }
});

async function enqueueIncidentAlert(incidentId: string, event: 'opened' | 'recovered') {
  await alertQueue.add(
    `incident-${event}`,
    { incidentId, event },
    { jobId: `incident-${incidentId}-${event}`, removeOnComplete: 500, removeOnFail: true },
  );
}

async function performIncidentAlert(incidentId: string, event: 'opened' | 'recovered') {
  const row = (
    await database.db
      .select({ incident: incidents, resource: integrationResources, channel: alertChannels })
      .from(incidents)
      .innerJoin(integrationResources, eq(incidents.resourceId, integrationResources.id))
      .innerJoin(alertChannels, eq(alertChannels.userId, integrationResources.userId))
      .where(and(eq(incidents.id, incidentId), eq(alertChannels.active, true)))
      .limit(1)
  )[0];
  if (!row) return;
  const scope = incidentAlertScope(row.incident.evidence);
  if (
    !shouldDeliverIncidentAlert({
      scopes: row.channel.scopes,
      events: row.channel.events,
      scope,
      event,
    })
  )
    return;
  const delivery = (
    await database.db
      .insert(alertDeliveries)
      .values({ channelId: row.channel.id, incidentId, event })
      .onConflictDoNothing()
      .returning({ id: alertDeliveries.id })
  )[0];
  if (!delivery) return;
  const resourceMetadata = row.resource.metadata as { demoRunId?: unknown };
  if (typeof resourceMetadata.demoRunId === 'string') {
    // Demo incidents must exercise the alert audit without notifying a user's real channel.
    await database.db
      .update(alertDeliveries)
      .set({ state: 'sent', statusCode: 204, attemptedAt: new Date() })
      .where(eq(alertDeliveries.id, delivery.id));
    return;
  }
  try {
    const url = decryptValue(row.channel.encryptedUrl, config.PAYLOAD_ENCRYPTION_KEY).toString(
      'utf8',
    );
    const provider = row.channel.provider === 'discord' ? 'discord' : 'generic';
    const body = Buffer.from(
      JSON.stringify(
        buildIncidentAlertPayload(provider, {
          event,
          incident: {
            id: row.incident.id,
            cause: row.incident.cause,
            summary: row.incident.summary,
            openedAt: row.incident.openedAt,
            recoveredAt: row.incident.recoveredAt,
          },
          integration: {
            id: row.resource.id,
            name: row.resource.name,
            type: row.resource.type,
            environment: row.resource.environment,
          },
        }),
      ),
    );
    const response = await safeRequest(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...parseHeaders(row.channel.encryptedHeaders),
      },
      body,
      timeoutMs: 10_000,
      maxResponseBytes: 16_384,
      allowHttp: config.DEPLOYMENT_MODE === 'selfhost' && row.channel.allowPrivateNetworks,
      allowPrivateNetworks:
        config.DEPLOYMENT_MODE === 'selfhost' && row.channel.allowPrivateNetworks,
      allowedPrivateCidrs: row.channel.allowedPrivateCidrs as string[],
    });
    await database.db
      .update(alertDeliveries)
      .set({
        state: response.statusCode >= 200 && response.statusCode < 300 ? 'sent' : 'failed',
        statusCode: response.statusCode,
        errorCategory: response.statusCode >= 200 && response.statusCode < 300 ? null : 'http',
        attemptedAt: new Date(),
      })
      .where(eq(alertDeliveries.id, delivery.id));
  } catch (error) {
    await database.db
      .update(alertDeliveries)
      .set({
        state: 'failed',
        errorCategory: error instanceof NetworkPolicyError ? error.category : 'connect',
        attemptedAt: new Date(),
      })
      .where(eq(alertDeliveries.id, delivery.id));
  }
}

const alertWorker = new Worker(
  'incident-alerts',
  async (job) => {
    if (typeof job.data.incidentId !== 'string') throw new Error('Missing incidentId');
    if (!['opened', 'recovered'].includes(job.data.event)) throw new Error('Invalid alert event');
    await performIncidentAlert(job.data.incidentId, job.data.event as 'opened' | 'recovered');
  },
  { connection: redis, concurrency: 2 },
);

function parseHeaders(value: string | null): Record<string, string> {
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

function incidentSummary(name: string, cause: string, failures: number): string {
  return `${name} is down after ${failures} consecutive failed checks. Cause: ${cause}.`;
}

const SLO_MIN_CHECKS = 5;

async function performMonitorCheck(monitorId: string) {
  const row = (
    await database.db
      .select({
        monitor: monitors,
        resourceId: integrationResources.id,
        userId: integrationResources.userId,
        resourceName: integrationResources.name,
        resourceActive: integrationResources.active,
      })
      .from(monitors)
      .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
      .where(eq(monitors.id, monitorId))
      .limit(1)
  )[0];
  if (!row || !row.resourceActive || row.monitor.state === 'paused') return;

  const startedAt = new Date();
  let statusCode: number | null = null;
  let latencyMs: number | null = null;
  let responseBytes = 0;
  let outcome: 'healthy' | 'degraded' | 'down' = 'down';
  let errorCategory: string | null = null;
  let contractResult: unknown = {};

  try {
    const url = decryptValue(row.monitor.encryptedUrl, config.PAYLOAD_ENCRYPTION_KEY).toString(
      'utf8',
    );
    const networkOptions = {
      timeoutMs: row.monitor.timeoutMs,
      allowPrivateNetworks:
        config.DEPLOYMENT_MODE === 'selfhost' && row.monitor.allowPrivateNetworks,
      allowedPrivateCidrs: row.monitor.allowedPrivateCidrs as string[],
    };
    if (row.monitor.protocol === 'icmp') {
      const response = await safeIcmpProbe(url, networkOptions);
      latencyMs = response.latencyMs;
      contractResult = { passed: true, protocol: 'icmp', remoteAddress: response.remoteAddress };
      outcome = 'healthy';
    } else {
      const response = await safeRequest(url, {
        ...networkOptions,
        method: row.monitor.method,
        headers: parseHeaders(row.monitor.encryptedHeaders),
        maxResponseBytes: 65_536,
        allowHttp: config.DEPLOYMENT_MODE === 'selfhost' && row.monitor.allowPrivateNetworks,
      });
      statusCode = response.statusCode;
      latencyMs = response.latencyMs;
      responseBytes = response.body.length;
      const evaluated = evaluateContract(response.statusCode, response.body, {
        minStatus: row.monitor.expectedMinStatus,
        maxStatus: row.monitor.expectedMaxStatus,
        expectedText: row.monitor.expectedText,
        expectedJsonPath: row.monitor.expectedJsonPath,
      });
      contractResult = evaluated;
      outcome = outcomeFromContract(evaluated);
      if (!evaluated.statusPassed) errorCategory = 'http';
      else if (!evaluated.passed) errorCategory = 'contract';
    }
  } catch (error) {
    errorCategory = error instanceof NetworkPolicyError ? error.category : 'connect';
    contractResult = {
      passed: false,
      failures: [error instanceof Error ? error.message : 'Monitor request failed'],
    };
  }

  const completedAt = new Date();
  const transition = deriveMonitorState(
    outcome,
    row.monitor.consecutiveFailures,
    row.monitor.consecutiveFailuresToOpen,
  );
  const monitorAlerts = await database.db.transaction(
    async (
      tx,
    ): Promise<
      Array<{
        incidentId: string;
        event: 'opened' | 'recovered';
      }>
    > => {
      const alerts: Array<{ incidentId: string; event: 'opened' | 'recovered' }> = [];
      await tx.insert(monitorChecks).values({
        monitorId,
        startedAt,
        completedAt,
        statusCode,
        latencyMs,
        responseBytes,
        outcome,
        errorCategory,
        contractResult,
      });
      await tx
        .update(monitors)
        .set({
          state: transition.state,
          consecutiveFailures: transition.consecutiveFailures,
          lastCheckAt: completedAt,
          updatedAt: completedAt,
        })
        .where(eq(monitors.id, monitorId));

      const openIncident = (
        await tx
          .select({ id: incidents.id })
          .from(incidents)
          .where(
            and(
              eq(incidents.resourceId, row.resourceId),
              eq(incidents.status, 'open'),
              ne(incidents.cause, 'slo_budget'),
            ),
          )
          .limit(1)
      )[0];
      if (transition.state === 'down' && !openIncident) {
        const cause = errorCategory ?? 'unknown';
        const created = (
          await tx
            .insert(incidents)
            .values({
              resourceId: row.resourceId,
              cause,
              summary: incidentSummary(row.resourceName, cause, transition.consecutiveFailures),
              evidence: { monitorId, statusCode, errorCategory, contractResult },
            })
            .returning({ id: incidents.id })
        )[0];
        if (created) alerts.push({ incidentId: created.id, event: 'opened' });
      } else if (transition.state === 'healthy' && openIncident) {
        await tx
          .update(incidents)
          .set({ status: 'recovered', recoveredAt: completedAt, updatedAt: completedAt })
          .where(eq(incidents.id, openIncident.id));
        alerts.push({ incidentId: openIncident.id, event: 'recovered' });
      }

      const sloSince = new Date(
        completedAt.getTime() - row.monitor.sloWindowDays * 24 * 60 * 60 * 1_000,
      );
      const sloChecks = await tx
        .select({ outcome: monitorChecks.outcome })
        .from(monitorChecks)
        .where(and(eq(monitorChecks.monitorId, monitorId), gte(monitorChecks.startedAt, sloSince)));
      if (sloChecks.length >= SLO_MIN_CHECKS) {
        const failed = sloChecks.filter((check) => check.outcome !== 'healthy').length;
        const budget = sloChecks.length * Math.max(0, 1 - row.monitor.sloTargetBps / 10_000);
        const breached = failed > 0 && failed >= budget;
        const sloIncident = (
          await tx
            .select({ id: incidents.id })
            .from(incidents)
            .where(
              and(
                eq(incidents.resourceId, row.resourceId),
                eq(incidents.cause, 'slo_budget'),
                eq(incidents.status, 'open'),
              ),
            )
            .limit(1)
        )[0];
        if (breached && !sloIncident) {
          const created = (
            await tx
              .insert(incidents)
              .values({
                resourceId: row.resourceId,
                cause: 'slo_budget',
                summary: `${row.resourceName} has exhausted its ${row.monitor.sloTargetBps / 100}% availability budget.`,
                evidence: {
                  monitorId,
                  windowDays: row.monitor.sloWindowDays,
                  target: row.monitor.sloTargetBps / 100,
                  checks: sloChecks.length,
                  failed,
                  budget,
                },
              })
              .returning({ id: incidents.id })
          )[0];
          if (created) alerts.push({ incidentId: created.id, event: 'opened' });
        } else if (!breached && sloIncident) {
          await tx
            .update(incidents)
            .set({ status: 'recovered', recoveredAt: completedAt, updatedAt: completedAt })
            .where(eq(incidents.id, sloIncident.id));
          alerts.push({ incidentId: sloIncident.id, event: 'recovered' });
        }
      }
      return alerts;
    },
  );

  for (const alert of monitorAlerts) await enqueueIncidentAlert(alert.incidentId, alert.event);

  await redis.publish(
    `hooktrials:monitors:user:${row.userId}`,
    JSON.stringify({ monitorId, resourceId: row.resourceId, state: transition.state, outcome }),
  );
}

const monitorWorker = new Worker(
  'monitor-checks',
  async (job) => {
    if (typeof job.data.monitorId !== 'string') throw new Error('Missing monitorId');
    const monitorId = job.data.monitorId;
    const owner = (
      await database.db
        .select({ userId: integrationResources.userId })
        .from(monitors)
        .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
        .where(eq(monitors.id, monitorId))
        .limit(1)
    )[0];
    if (!owner) return;

    const token = `${job.id ?? Date.now()}:${monitorId}`;
    const releaseUser = await acquireMonitorSlot(
      Array.from(
        { length: MONITOR_USER_CONCURRENCY },
        (_, slot) => `hooktrials:monitor-user:${owner.userId}:slot:${slot}`,
      ),
      token,
      true,
    );
    if (!releaseUser) return;
    let releaseMonitor: (() => Promise<void>) | null = null;
    try {
      releaseMonitor = await acquireMonitorSlot(
        [`hooktrials:monitor-lock:${monitorId}`],
        token,
        false,
      );
      if (!releaseMonitor) return;
      await performMonitorCheck(monitorId);
    } finally {
      if (releaseMonitor) await releaseMonitor();
      if (releaseUser) await releaseUser();
    }
  },
  { connection: redis, concurrency: 4 },
);

monitorWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Monitor check failed');
});

async function scheduleDueMonitors() {
  const now = new Date();
  const due = await database.db
    .select({
      id: monitors.id,
      intervalSeconds: monitors.intervalSeconds,
    })
    .from(monitors)
    .innerJoin(integrationResources, eq(monitors.resourceId, integrationResources.id))
    .where(
      and(
        eq(integrationResources.active, true),
        ne(monitors.state, 'paused'),
        lte(monitors.nextCheckAt, now),
      ),
    )
    .limit(50);

  for (const monitor of due) {
    const claimed = await database.db
      .update(monitors)
      .set({ nextCheckAt: new Date(now.getTime() + monitor.intervalSeconds * 1_000) })
      .where(and(eq(monitors.id, monitor.id), lte(monitors.nextCheckAt, now)))
      .returning({ id: monitors.id });
    if (!claimed[0]) continue;
    await monitorQueue.add(
      'scheduled-check',
      { monitorId: monitor.id },
      { jobId: `monitor-${monitor.id}-${now.getTime()}`, removeOnComplete: 100, removeOnFail: 100 },
    );
  }
}

async function scheduleQueuedDeliveries() {
  const now = new Date();
  const queued = await database.db
    .select({ id: destinationDeliveries.id, nextAttemptAt: destinationDeliveries.nextAttemptAt })
    .from(destinationDeliveries)
    .innerJoin(endpoints, eq(destinationDeliveries.resourceId, endpoints.resourceId))
    .where(
      and(
        eq(destinationDeliveries.state, 'queued'),
        eq(endpoints.deliveryPaused, false),
        or(
          isNull(destinationDeliveries.nextAttemptAt),
          lte(destinationDeliveries.nextAttemptAt, now),
        ),
      ),
    )
    .limit(100);
  for (const delivery of queued) {
    await deliveryQueue.add(
      'durable-delivery',
      { deliveryId: delivery.id },
      { jobId: `delivery-${delivery.id}`, removeOnComplete: 500, removeOnFail: true },
    );
  }
}

await cleanupExpiredData();
await scheduleDueMonitors();
await scheduleQueuedDeliveries();
const cleanupTimer = setInterval(() => void cleanupExpiredData(), 60 * 60 * 1_000);
const monitorScheduleTimer = setInterval(
  () =>
    void scheduleDueMonitors().catch((error) =>
      logger.error({ error }, 'Monitor scheduling failed'),
    ),
  15_000,
);
const deliveryScheduleTimer = setInterval(
  () =>
    void scheduleQueuedDeliveries().catch((error) =>
      logger.error({ error }, 'Delivery scheduling failed'),
    ),
  10_000,
);

async function shutdown(signal: string) {
  clearInterval(cleanupTimer);
  clearInterval(monitorScheduleTimer);
  clearInterval(deliveryScheduleTimer);
  logger.info({ signal }, 'Worker shutting down');
  await Promise.all([
    analysisWorker.close(),
    monitorWorker.close(),
    deliveryWorker.close(),
    alertWorker.close(),
    monitorQueue.close(),
    deliveryQueue.close(),
    alertQueue.close(),
  ]);
  redis.disconnect();
  await database.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

logger.info('HookTrials worker started');
