import pino from 'pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'password',
  'secret',
  'token',
];

export function createLogger(level = 'info') {
  return pino({
    level,
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
  });
}
