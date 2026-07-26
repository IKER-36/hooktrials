import { randomBytes } from 'node:crypto';

const DEMO_MUTATION_LOCK_MS = 5 * 60 * 1_000;
const releaseScript =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

export interface DemoLockRedis {
  set(
    key: string,
    value: string,
    expiryMode: 'PX',
    expiry: number,
    condition: 'NX',
  ): Promise<string | null>;
  eval(script: string, numberOfKeys: number, key: string, token: string): Promise<unknown>;
}

export function demoMutationLockKey(userId: string): string {
  return `hooktrials:demo-mutation:${userId}`;
}

export async function acquireDemoMutationLock(
  redis: DemoLockRedis,
  userId: string,
  token = randomBytes(24).toString('base64url'),
): Promise<{ release(): Promise<void> } | null> {
  const key = demoMutationLockKey(userId);
  const acquired = await redis.set(key, token, 'PX', DEMO_MUTATION_LOCK_MS, 'NX');
  if (acquired !== 'OK') return null;
  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
      await redis.eval(releaseScript, 1, key, token);
    },
  };
}
