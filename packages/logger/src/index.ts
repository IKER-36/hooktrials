import pino from 'pino';

const sensitiveHeaderPattern =
  /(?:authorization|cookie|set-cookie|proxy-authorization|api[-_]?key|auth[-_]?token|secret|password|signature|token)/i;
const blockedForwardHeaderPattern =
  /^(?:authorization|cookie|set-cookie|proxy-authorization|x-api-key|x-auth-token|x-webhook-secret|x-api-secret)$/i;

export function isSensitiveHeaderName(name: string): boolean {
  return sensitiveHeaderPattern.test(name);
}

export function isBlockedForwardHeaderName(name: string): boolean {
  return blockedForwardHeaderPattern.test(name);
}

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'password',
  'secret',
  'token',
];

export function redactHeaders(value: unknown): Record<string, string | string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, headerValue]) => [
      key,
      isSensitiveHeaderName(key)
        ? '[REDACTED]'
        : Array.isArray(headerValue)
          ? headerValue.filter((item): item is string => typeof item === 'string')
          : typeof headerValue === 'string'
            ? headerValue
            : String(headerValue),
    ]),
  );
}

export function redactRequestUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  const path = raw.split('?', 1)[0] ?? '';
  return path.replace(/^\/i\/[^/]+(?=\/|$)/, '/i/[REDACTED]');
}

export function createLogger(level = 'info') {
  return pino({
    level,
    serializers: {
      req: (request: {
        method?: string;
        url?: string;
        hostname?: string;
        remoteAddress?: string;
      }) => ({
        method: request.method,
        url: redactRequestUrl(request.url),
        hostname: request.hostname,
        remoteAddress: request.remoteAddress,
      }),
    },
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
  });
}
