import { describe, expect, it } from 'vitest';
import {
  evidenceFilename,
  evidenceJson,
  evidenceMarkdown,
  type RedactedEvidence,
} from './evidence.js';

const evidence: RedactedEvidence = {
  schemaVersion: '1.0',
  generatedAt: '2026-07-26T10:00:00.000Z',
  integration: { name: 'Payments | production', mode: 'protect', environment: 'production' },
  event: {
    correlationKey: 'evt_123',
    bodyHash: 'hash_123',
    firstSeenAt: '2026-07-26T09:59:59.000Z',
    lastSeenAt: '2026-07-26T10:00:00.000Z',
  },
  attempts: [
    {
      id: 'attempt-1',
      sequence: 1,
      method: 'POST',
      receivedAt: '2026-07-26T09:59:59.000Z',
      responseStatus: 202,
      responseDelayMs: 4,
      signatureProvider: 'github',
      signatureStatus: 'valid',
      contractResult: { configured: true, passed: true },
    },
  ],
  deliveries: [
    {
      id: 'delivery-1',
      sequence: 1,
      kind: 'forward',
      state: 'succeeded',
      statusCode: 204,
      latencyMs: 18,
      errorCategory: null,
      startedAt: '2026-07-26T09:59:59.100Z',
      completedAt: '2026-07-26T09:59:59.118Z',
    },
  ],
  report: { status: 'passed', score: 100, result: { recovered: true } },
  redacted: true,
  redactions: ['Payload bodies', 'Captured request headers'],
};

describe('evidence export', () => {
  it('creates a stable attachment filename', () => {
    expect(evidenceFilename('12345678-abcd', 'json')).toBe('hooktrials-evidence-12345678.json');
    expect(evidenceFilename('12345678-abcd', 'markdown')).toBe('hooktrials-evidence-12345678.md');
  });

  it('serializes redacted JSON without adding restricted fields', () => {
    const output = evidenceJson(evidence);
    expect(JSON.parse(output)).toMatchObject({ schemaVersion: '1.0', redacted: true });
    expect(output).not.toContain('"destinationUrl":');
    expect(output).not.toContain('"headers":');
    expect(output).not.toContain('"payload":');
  });

  it('renders portable Markdown and escapes table delimiters', () => {
    const output = evidenceMarkdown(evidence);
    expect(output).toContain('# HookTrials reliability evidence');
    expect(output).toContain('Payments \\| production');
    expect(output).toContain('| 1 | 2026-07-26T09:59:59.000Z | POST | 202 |');
    expect(output).toContain('Status: passed · Score: 100/100');
    expect(output).not.toContain('destinationUrl');
  });
});
