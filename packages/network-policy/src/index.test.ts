import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { RequestListener } from 'node:http';
import { isBlockedAddress, NetworkPolicyError, safeRequest, validateTarget } from './index.js';

const publicResolver = async () => [{ address: '93.184.216.34', family: 4 as const }];

describe('isBlockedAddress', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.4.2',
    '192.168.1.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fd12::1',
    'fe80::1',
    'ff02::1',
    '2001:db8::1',
  ])('blocks %s', (address) => expect(isBlockedAddress(address)).toBe(true));

  it.each(['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700:4700::1111'])('allows %s', (address) =>
    expect(isBlockedAddress(address)).toBe(false),
  );
});

describe('validateTarget', () => {
  it('accepts a public HTTPS target', async () => {
    const target = await validateTarget('https://example.com/health', { resolver: publicResolver });
    expect(target.hostname).toBe('example.com');
    expect(target.addresses[0]?.address).toBe('93.184.216.34');
  });

  it.each([
    'http://example.com',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'https://service.local',
    'https://127.0.0.1',
    'https://2130706433',
    'https://0x7f000001',
    'https://[::1]',
  ])('rejects unsafe target %s', async (url) => {
    await expect(validateTarget(url, { resolver: publicResolver })).rejects.toBeInstanceOf(
      NetworkPolicyError,
    );
  });

  it('rejects any private DNS answer', async () => {
    await expect(
      validateTarget('https://example.com', {
        resolver: async () => [
          { address: '93.184.216.34', family: 4 },
          { address: '127.0.0.1', family: 4 },
        ],
      }),
    ).rejects.toMatchObject({ category: 'blocked' });
  });

  it('allows an explicit self-host private CIDR', async () => {
    const target = await validateTarget('http://internal.example', {
      allowHttp: true,
      allowPrivateNetworks: true,
      allowedPrivateCidrs: ['10.20.0.0/16'],
      resolver: async () => [{ address: '10.20.4.7', family: 4 }],
    });
    expect(target.addresses[0]?.address).toBe('10.20.4.7');
  });

  it('does not allow broad private access without a CIDR allowlist', async () => {
    await expect(
      validateTarget('http://internal.example', {
        allowHttp: true,
        allowPrivateNetworks: true,
        resolver: async () => [{ address: '10.20.4.7', family: 4 }],
      }),
    ).rejects.toMatchObject({ category: 'blocked' });
  });

  it('revalidates DNS on every call', async () => {
    let calls = 0;
    const resolver = async () => {
      calls += 1;
      return calls === 1
        ? [{ address: '93.184.216.34', family: 4 as const }]
        : [{ address: '127.0.0.1', family: 4 as const }];
    };
    await validateTarget('https://example.com', { resolver });
    await expect(validateTarget('https://example.com', { resolver })).rejects.toMatchObject({
      category: 'blocked',
    });
  });
});

describe('safeRequest', () => {
  async function withServer(handler: RequestListener, run: (url: string) => Promise<void>) {
    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server missing address');
    try {
      await run(`http://127.0.0.1:${address.port}`);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }

  const localPolicy = {
    allowHttp: true,
    allowPrivateNetworks: true,
    allowedPrivateCidrs: ['127.0.0.0/8'],
  };

  it('pins and reads a bounded response', async () => {
    await withServer(
      (_request, response) => response.end('healthy'),
      async (url) => {
        const result = await safeRequest(url, { ...localPolicy, maxResponseBytes: 32 });
        expect(result.statusCode).toBe(200);
        expect(result.body.toString()).toBe('healthy');
        expect(result.remoteAddress).toBe('127.0.0.1');
      },
    );
  });

  it('does not follow redirects', async () => {
    await withServer(
      (_request, response) => {
        response.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' });
        response.end();
      },
      async (url) => {
        await expect(safeRequest(url, localPolicy)).rejects.toMatchObject({ category: 'redirect' });
      },
    );
  });

  it('aborts oversized responses', async () => {
    await withServer(
      (_request, response) => response.end('x'.repeat(128)),
      async (url) => {
        await expect(
          safeRequest(url, { ...localPolicy, maxResponseBytes: 16 }),
        ).rejects.toMatchObject({ category: 'response_too_large' });
      },
    );
  });

  it('enforces request timeout', async () => {
    await withServer(
      (_request, response) => {
        setTimeout(() => response.end('late'), 500);
      },
      async (url) => {
        await expect(safeRequest(url, { ...localPolicy, timeoutMs: 250 })).rejects.toMatchObject({
          category: 'timeout',
        });
      },
    );
  });
});
