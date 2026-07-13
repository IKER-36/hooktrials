import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt } from 'drizzle-orm';
import { sessions, users } from '@hooktrials/database';
import type { createDatabase } from '@hooktrials/database';

type Database = ReturnType<typeof createDatabase>['db'];

const SESSION_COOKIE = 'hooktrials_session';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(db: Database, userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: Date,
  secure: boolean,
) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSession(db: Database, request: FastifyRequest, reply: FastifyReply) {
  const token = request.cookies[SESSION_COOKIE];
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function getAuthenticatedUser(db: Database, request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return result[0] ?? null;
}
