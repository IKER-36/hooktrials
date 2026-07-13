import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { performance } from 'node:perf_hooks';

export type NetworkErrorCategory =
  | 'invalid_url'
  | 'blocked'
  | 'dns'
  | 'connect'
  | 'tls'
  | 'timeout'
  | 'response_too_large'
  | 'redirect';

export class NetworkPolicyError extends Error {
  constructor(
    public readonly category: NetworkErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = 'NetworkPolicyError';
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface NetworkPolicyOptions {
  allowHttp?: boolean;
  allowPrivateNetworks?: boolean;
  allowedPrivateCidrs?: string[];
  resolver?: (hostname: string) => Promise<ResolvedAddress[]>;
}

export interface ValidatedTarget {
  url: URL;
  hostname: string;
  addresses: ResolvedAddress[];
}

export interface SafeRequestOptions extends NetworkPolicyOptions {
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: Buffer;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface SafeResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  latencyMs: number;
  remoteAddress: string;
}

function parseIpv4(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => part >= 0 && part <= 255) ? parts : null;
}

function inIpv4Range(parts: number[], base: number[], prefix: number): boolean {
  const value = parts.reduce((total, part) => (total << 8) | part, 0) >>> 0;
  const network = base.reduce((total, part) => (total << 8) | part, 0) >>> 0;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (network & mask);
}

const blockedIpv4Ranges: Array<[number[], number]> = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 0, 2, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[198, 51, 100, 0], 24],
  [[203, 0, 113, 0], 24],
  [[224, 0, 0, 0], 4],
  [[240, 0, 0, 0], 4],
];

function normalizedIpv6(address: string): string {
  return address.toLowerCase().split('%')[0] ?? address.toLowerCase();
}

function mappedIpv4(address: string): string | null {
  const normalized = normalizedIpv6(address);
  const dotted = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (dotted) return dotted;
  const hex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const high = Number.parseInt(hex[1]!, 16);
  const low = Number.parseInt(hex[2]!, 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isBlockedAddress(address: string): boolean {
  const ipv4 = parseIpv4(address);
  if (ipv4) return blockedIpv4Ranges.some(([base, prefix]) => inIpv4Range(ipv4, base, prefix));

  if (isIP(address) !== 6) return true;
  const mapped = mappedIpv4(address);
  if (mapped) return isBlockedAddress(mapped);
  const value = normalizedIpv6(address);
  return (
    value === '::' ||
    value === '::1' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value) ||
    value.startsWith('ff') ||
    value.startsWith('2001:db8:') ||
    value === '2001:db8::'
  );
}

async function defaultResolver(hostname: string): Promise<ResolvedAddress[]> {
  try {
    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    return records.map((record) => ({
      address: record.address,
      family: record.family === 6 ? 6 : 4,
    }));
  } catch (error) {
    throw new NetworkPolicyError(
      'dns',
      error instanceof Error ? `DNS resolution failed: ${error.message}` : 'DNS resolution failed',
    );
  }
}

function explicitlyAllowed(address: string, options: NetworkPolicyOptions): boolean {
  if (!options.allowPrivateNetworks) return false;
  if (!options.allowedPrivateCidrs || options.allowedPrivateCidrs.length === 0) return false;
  const ipv4 = parseIpv4(address);
  if (!ipv4) return options.allowedPrivateCidrs.includes(address);
  return options.allowedPrivateCidrs.some((cidr) => {
    const [base, prefixText] = cidr.split('/');
    const baseParts = base ? parseIpv4(base) : null;
    const prefix = Number(prefixText);
    return Boolean(
      baseParts &&
      Number.isInteger(prefix) &&
      prefix >= 0 &&
      prefix <= 32 &&
      inIpv4Range(ipv4, baseParts, prefix),
    );
  });
}

export async function validateTarget(
  input: string,
  options: NetworkPolicyOptions = {},
): Promise<ValidatedTarget> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new NetworkPolicyError('invalid_url', 'Target must be a valid absolute URL');
  }
  if (url.username || url.password) {
    throw new NetworkPolicyError('blocked', 'Credentials in target URLs are not allowed');
  }
  if (url.protocol !== 'https:' && !(options.allowHttp && url.protocol === 'http:')) {
    throw new NetworkPolicyError('blocked', 'Target must use HTTPS');
  }
  const hostname =
    url.hostname.startsWith('[') && url.hostname.endsWith(']')
      ? url.hostname.slice(1, -1)
      : url.hostname;
  if (!hostname || hostname.toLowerCase().endsWith('.local')) {
    throw new NetworkPolicyError('blocked', 'Local hostnames are not allowed');
  }

  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await (options.resolver ?? defaultResolver)(hostname);
  if (addresses.length === 0)
    throw new NetworkPolicyError('dns', 'Target resolved to no addresses');

  const seen = new Set<string>();
  const normalized = addresses.filter((record) => {
    if (seen.has(record.address)) return false;
    seen.add(record.address);
    return true;
  });
  for (const record of normalized) {
    if (isIP(record.address) !== record.family) {
      throw new NetworkPolicyError('dns', 'Resolver returned an invalid address');
    }
    if (isBlockedAddress(record.address) && !explicitlyAllowed(record.address, options)) {
      throw new NetworkPolicyError(
        'blocked',
        `Target address is not publicly routable: ${record.address}`,
      );
    }
  }
  return { url, hostname, addresses: normalized };
}

function categorizeRequestError(error: unknown): NetworkPolicyError {
  if (error instanceof NetworkPolicyError) return error;
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? '';
  if (['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ABORT_ERR'].includes(code)) {
    return new NetworkPolicyError('timeout', 'Request timed out');
  }
  if (
    code.startsWith('ERR_TLS') ||
    ['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code)
  ) {
    return new NetworkPolicyError('tls', 'TLS negotiation failed');
  }
  return new NetworkPolicyError(
    'connect',
    error instanceof Error ? `Connection failed: ${error.message}` : 'Connection failed',
  );
}

export async function safeRequest(
  input: string,
  options: SafeRequestOptions = {},
): Promise<SafeResponse> {
  const target = await validateTarget(input, options);
  const address = target.addresses[0]!;
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 10_000, 250), 30_000);
  const maxResponseBytes = Math.min(Math.max(options.maxResponseBytes ?? 65_536, 0), 1_048_576);
  const started = performance.now();

  return await new Promise<SafeResponse>((resolve, reject) => {
    const requestFn = target.url.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = requestFn(
      target.url,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
        lookup(_hostname, lookupOptions, callback) {
          const requestedFamily = typeof lookupOptions === 'object' ? lookupOptions.family : 0;
          if (requestedFamily && requestedFamily !== address.family) {
            callback(new NetworkPolicyError('blocked', 'Validated address family mismatch'), '', 0);
            return;
          }
          if (typeof lookupOptions === 'object' && lookupOptions.all) {
            callback(null, [address]);
            return;
          }
          callback(null, address.address, address.family);
        },
        servername: target.hostname,
        timeout: timeoutMs,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
          response.resume();
          reject(new NetworkPolicyError('redirect', 'Redirect responses are not followed'));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxResponseBytes) {
            response.destroy(
              new NetworkPolicyError(
                'response_too_large',
                'Response exceeded configured byte limit',
              ),
            );
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () =>
          resolve({
            statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
            latencyMs: Math.max(0, Math.round(performance.now() - started)),
            remoteAddress: address.address,
          }),
        );
        response.on('error', (error) => reject(categorizeRequestError(error)));
      },
    );
    request.on('timeout', () =>
      request.destroy(new NetworkPolicyError('timeout', 'Request timed out')),
    );
    request.on('error', (error) => reject(categorizeRequestError(error)));
    if (options.body) request.write(options.body);
    request.end();
  });
}
