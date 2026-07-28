import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { authTokens } from '@hooktrials/database';
import type { createDatabase } from '@hooktrials/database';

type Database = ReturnType<typeof createDatabase>['db'];
export type AuthTokenPurpose = 'email_verification' | 'password_reset';

export function hashAuthToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueAuthToken(
  db: Database,
  userId: string,
  purpose: AuthTokenPurpose,
  expiresAt: Date,
) {
  await db
    .delete(authTokens)
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
      ),
    );

  const token = randomBytes(32).toString('base64url');
  await db.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: hashAuthToken(token),
    expiresAt,
  });
  return token;
}
