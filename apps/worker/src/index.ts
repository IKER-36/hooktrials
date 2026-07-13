import { readRuntimeConfig } from '@hooktrials/config';
import { decryptValue, sha256 } from '@hooktrials/crypto';
import { attempts, createDatabase, events, reports, sessions } from '@hooktrials/database';
import { createLogger } from '@hooktrials/logger';
import { Worker } from 'bullmq';
import { asc, eq, lt } from 'drizzle-orm';
import { Redis } from 'ioredis';

const config = readRuntimeConfig();
const logger = createLogger(config.LOG_LEVEL);
const database = createDatabase(config.DATABASE_URL);
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

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
  const recovered = lastAttempt.responseStatus >= 200 && lastAttempt.responseStatus < 300;
  const retryObserved = rows.length > 1;
  const score = Math.min(
    100,
    (recovered ? 45 : 0) + (payloadStable ? 35 : 0) + (retryObserved ? 20 : 0),
  );
  const result = {
    attemptCount: rows.length,
    recovered,
    payloadStable,
    retryObserved,
    statuses: rows.map((attempt) => attempt.responseStatus),
    analyzedAt: new Date().toISOString(),
  };

  await database.db
    .insert(reports)
    .values({
      eventId,
      status: recovered && payloadStable ? 'passed' : 'pending',
      score,
      result,
      completedAt: recovered ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: reports.eventId,
      set: {
        status: recovered && payloadStable ? 'passed' : 'pending',
        score,
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
  if (removedEvents.length > 0) {
    logger.info({ count: removedEvents.length }, 'Expired events removed');
  }
}

const worker = new Worker(
  'event-analysis',
  async (job) => {
    if (typeof job.data.eventId !== 'string') throw new Error('Missing eventId');
    await analyzeEvent(job.data.eventId);
  },
  { connection: redis, concurrency: 4 },
);

worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error }, 'Analysis job failed');
});

await cleanupExpiredData();
const cleanupTimer = setInterval(() => void cleanupExpiredData(), 60 * 60 * 1_000);

async function shutdown(signal: string) {
  clearInterval(cleanupTimer);
  logger.info({ signal }, 'Worker shutting down');
  await worker.close();
  redis.disconnect();
  await database.close();
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

logger.info('HookTrials worker started');
