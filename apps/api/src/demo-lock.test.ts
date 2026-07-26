import { describe, expect, it, vi } from 'vitest';
import { acquireDemoMutationLock, demoMutationLockKey, type DemoLockRedis } from './demo-lock.js';

describe('demo mutation lock', () => {
  it('isolates mutations by user and releases only its own token', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      eval: vi.fn().mockResolvedValue(1),
    } as unknown as DemoLockRedis;
    const lock = await acquireDemoMutationLock(redis, 'user-1', 'token-1');
    expect(redis.set).toHaveBeenCalledWith(
      demoMutationLockKey('user-1'),
      'token-1',
      'PX',
      300_000,
      'NX',
    );
    await lock?.release();
    await lock?.release();
    expect(redis.eval).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('get'"),
      1,
      demoMutationLockKey('user-1'),
      'token-1',
    );
  });

  it('rejects a concurrent mutation while the lock exists', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue(null),
      eval: vi.fn(),
    } as unknown as DemoLockRedis;
    await expect(acquireDemoMutationLock(redis, 'user-2', 'token-2')).resolves.toBeNull();
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
