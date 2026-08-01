import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { apiKeys, sessions, users } from '@hooktrials/database';
import type { createDatabase } from '@hooktrials/database';

type Database = ReturnType<typeof createDatabase>['db'];

const SESSION_COOKIE = 'hooktrials_session';

export type ApiKeyScope = 'read' | 'write';

export interface AuthenticatedPrincipal {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    emailVerified: boolean;
    emailVerificationRequired: boolean;
    pendingEmail: string | null;
    avatarUrl: string | null;
    onboardingCompletedAt: Date | null;
  };
  authType: 'session' | 'api_key';
  scopes: ApiKeyScope[];
}

export function hashToken(token: string): string {
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

async function getSessionPrincipal(db: Database, request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;

  const result = await db
    .select({
      sessionId: sessions.id,
      sessionLastSeenAt: sessions.lastSeenAt,
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
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const user = result[0];
  if (!user) return null;
  if (user.sessionLastSeenAt.getTime() < Date.now() - 5 * 60 * 1_000) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.id, user.sessionId));
  }
  const { sessionId: _sessionId, sessionLastSeenAt: _sessionLastSeenAt, ...sessionUser } = user;
  return {
    user: sessionUser,
    authType: 'session',
    scopes: ['read', 'write'],
  } satisfies AuthenticatedPrincipal;
}

async function getApiKeyPrincipal(db: Database, request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();
  if (!/^htk_[A-Za-z0-9_-]{32,128}$/.test(token)) return null;

  const result = await db
    .select({
      keyId: apiKeys.id,
      user: {
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        emailVerified: users.emailVerified,
        emailVerificationRequired: users.emailVerificationRequired,
        pendingEmail: users.pendingEmail,
        avatarUrl: users.avatarUrl,
        onboardingCompletedAt: users.onboardingCompletedAt,
      },
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, hashToken(token)), isNull(apiKeys.revokedAt)))
    .limit(1);
  const record = result[0];
  if (!record) return null;

  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, record.keyId));
  const scopes = Array.isArray(record.scopes)
    ? record.scopes.filter((scope): scope is ApiKeyScope => scope === 'read' || scope === 'write')
    : [];
  return { user: record.user, authType: 'api_key', scopes } satisfies AuthenticatedPrincipal;
}

export async function getAuthenticatedPrincipal(db: Database, request: FastifyRequest) {
  return (await getSessionPrincipal(db, request)) ?? (await getApiKeyPrincipal(db, request));
}

export async function getAuthenticatedUser(db: Database, request: FastifyRequest) {
  const principal = await getAuthenticatedPrincipal(db, request);
  return principal?.user ?? null;
}
