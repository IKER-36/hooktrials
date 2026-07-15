import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildReliabilityReplay,
  calculateIntegrationReadiness,
  calculateMonitorScore,
  calculateWebhookScore,
  evaluateWebhookContract,
  verifyWebhookSignature,
} from './index.js';

describe('webhook signatures', () => {
  it('verifies GitHub HMAC and rejects malformed values', () => {
    const body = Buffer.from('{"zen":"safe"}');
    const signature = createHmac('sha256', 'secret123').update(body).digest('hex');
    expect(
      verifyWebhookSignature({
        provider: 'github',
        secret: 'secret123',
        headers: { 'x-hub-signature-256': `sha256=${signature}` },
        body,
      }).status,
    ).toBe('valid');
    expect(
      verifyWebhookSignature({
        provider: 'github',
        secret: 'secret123',
        headers: { 'x-hub-signature-256': 'sha256=bad' },
        body,
      }).status,
    ).toBe('invalid');
    expect(
      verifyWebhookSignature({ provider: 'github', secret: 'secret123', headers: {}, body }).status,
    ).toBe('missing');
  });

  it('verifies Stripe signed payload and enforces timestamp tolerance', () => {
    const body = Buffer.from('{"id":"evt_123"}');
    const timestamp = 1_700_000_000;
    const signature = createHmac('sha256', 'whsec_test')
      .update(`${timestamp}.`)
      .update(body)
      .digest('hex');
    const headers = { 'stripe-signature': `t=${timestamp},v1=bad,v1=${signature}` };
    expect(
      verifyWebhookSignature({
        provider: 'stripe',
        secret: 'whsec_test',
        headers,
        body,
        nowSeconds: timestamp,
      }).status,
    ).toBe('valid');
    expect(
      verifyWebhookSignature({
        provider: 'stripe',
        secret: 'whsec_test',
        headers,
        body,
        nowSeconds: timestamp + 301,
      }).status,
    ).toBe('stale');
  });
});

describe('webhook contracts', () => {
  it('checks method, headers and JSON paths', () => {
    const result = evaluateWebhookContract({
      method: 'POST',
      headers: { 'x-event': 'created' },
      body: Buffer.from('{"data":{"ready":true}}'),
      contract: {
        method: 'POST',
        requiredHeaders: { 'x-event': 'created' },
        jsonPaths: { '$.data.ready': true },
      },
    });
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(3);
  });
  it('returns evidence for invalid JSON and mismatches', () => {
    const result = evaluateWebhookContract({
      method: 'GET',
      headers: {},
      body: Buffer.from('nope'),
      contract: {
        method: 'POST',
        requiredHeaders: { 'x-event': '' },
        jsonPaths: { '$.data.ready': true },
      },
    });
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => !check.passed).length).toBe(3);
  });
});

describe('explainable scores', () => {
  it('links every monitor deduction to evidence', () => {
    const result = calculateMonitorScore({
      availability: 90,
      p95LatencyMs: 900,
      timeoutMs: 1_000,
      contractFailures: 2,
      networkFailures: 1,
      checks: 10,
      openIncident: true,
    });
    expect(result.score).toBeLessThan(100);
    expect(result.deductions.every((item) => Object.keys(item.evidence).length > 0)).toBe(true);
  });
  it('penalizes webhook dead letters, retries and integrity failures', () => {
    const result = calculateWebhookScore({
      deliveries: 10,
      failedDeliveries: 3,
      retries: 2,
      deadLetters: 1,
      invalidSignatures: 1,
      contractFailures: 1,
      inboundAttempts: 10,
      openIncident: false,
    });
    expect(result.deductions.map((item) => item.code)).toEqual([
      'delivery',
      'retries',
      'dead_letter',
      'signature',
      'contract',
    ]);
  });
});

describe('integration readiness', () => {
  it('weights every production control and explains missing actions', () => {
    const readiness = calculateIntegrationReadiness({
      active: true,
      externalAccess: true,
      contractConfigured: true,
      signatureConfigured: false,
      destinationConfigured: true,
      protectMode: true,
      attemptsObserved: 4,
      recoveryDemonstrated: true,
      evidenceGenerated: true,
      openIncident: false,
    });
    expect(readiness.score).toBe(85);
    expect(readiness.level).toBe('production_ready');
    expect(readiness.checks.find((check) => check.code === 'signature')).toMatchObject({
      passed: false,
      points: 15,
    });
    expect(readiness.checks.every((check) => check.action.length > 0)).toBe(true);
  });
});

describe('reliability replay', () => {
  it('explains a protected failure followed by recovery', () => {
    const replay = buildReliabilityReplay({
      mode: 'protect',
      attempts: [
        {
          sequence: 1,
          receivedAt: '2026-07-15T10:00:00.000Z',
          responseStatus: 202,
          responseDelayMs: 0,
          signatureProvider: 'stripe',
          signatureStatus: 'valid',
          contractResult: { configured: true, passed: true },
        },
      ],
      deliveries: [
        {
          sequence: 1,
          state: 'failed',
          statusCode: 503,
          errorCategory: 'http_status',
          startedAt: '2026-07-15T10:00:00.100Z',
          completedAt: '2026-07-15T10:00:00.200Z',
        },
        {
          sequence: 2,
          state: 'succeeded',
          statusCode: 200,
          errorCategory: null,
          startedAt: '2026-07-15T10:00:02.000Z',
          completedAt: '2026-07-15T10:00:02.100Z',
        },
      ],
    });
    expect(replay.outcome).toBe('recovered');
    expect(replay.durationMs).toBe(2_100);
    expect(replay.diagnosis).toContain('failed 1 time');
    expect(replay.actions).toContain(
      'Check destination availability and preserve bounded exponential retries.',
    );
  });
});
