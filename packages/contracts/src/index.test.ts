import { describe, expect, it } from 'vitest';
import {
  alertChannelInputSchema,
  createEndpointInputSchema,
  destinationPreflightInputSchema,
  evidenceExportQuerySchema,
  syntheticEventInputSchema,
} from './index.js';

describe('alert channel input', () => {
  it('keeps the existing generic behavior by default', () => {
    expect(
      alertChannelInputSchema.parse({ url: 'https://alerts.example.com/hooktrials' }),
    ).toMatchObject({
      provider: 'generic',
      scopes: ['monitor', 'webhook'],
      events: ['opened', 'recovered'],
    });
  });

  it('allows rotating preferences without resubmitting a write-only URL', () => {
    expect(
      alertChannelInputSchema.parse({
        provider: 'discord',
        scopes: ['monitor'],
        events: ['opened'],
      }),
    ).toMatchObject({ provider: 'discord', scopes: ['monitor'], events: ['opened'] });
  });

  it('requires at least one scope and one event', () => {
    expect(() =>
      alertChannelInputSchema.parse({
        url: 'https://discord.com/api/webhooks/123/token',
        provider: 'discord',
        scopes: [],
      }),
    ).toThrow();
  });
});

describe('createEndpointInputSchema', () => {
  it('keeps the existing endpoint creation flow in trial mode', () => {
    const input = createEndpointInputSchema.parse({ name: 'staging-test' });
    expect(input.mode).toBe('trial');
    expect(input.provider).toBe('generic');
    expect(input.environment).toBe('test');
  });

  it('accepts an atomic protected live webhook route', () => {
    const input = createEndpointInputSchema.parse({
      name: 'stripe-production',
      provider: 'stripe',
      mode: 'protect',
      environment: 'production',
      destinationUrl: 'https://api.example.com/webhooks/stripe',
      signatureProvider: 'stripe',
      signatureSecret: 'whsec_test_secret',
      contract: { method: 'POST', requiredHeaders: { 'stripe-signature': '' }, jsonPaths: {} },
      confirmProductionImpact: true,
    });
    expect(input.destinationUrl).toBe('https://api.example.com/webhooks/stripe');
    expect(input.retryMaxAttempts).toBe(5);
  });

  it('rejects a managed route without a destination', () => {
    const result = createEndpointInputSchema.safeParse({
      name: 'missing-destination',
      mode: 'observe',
    });
    expect(result.success).toBe(false);
  });

  it('requires explicit confirmation for production traffic', () => {
    const result = createEndpointInputSchema.safeParse({
      name: 'production-route',
      mode: 'protect',
      environment: 'production',
      destinationUrl: 'https://api.example.com/webhooks',
    });
    expect(result.success).toBe(false);
  });
});

describe('destinationPreflightInputSchema', () => {
  it('applies safe defaults for a generic destination check', () => {
    const input = destinationPreflightInputSchema.parse({
      url: 'https://api.example.com/webhooks',
    });

    expect(input.provider).toBe('generic');
    expect(input.signatureConfigured).toBe(false);
    expect(input.contractConfigured).toBe(true);
    expect(input.timeoutMs).toBe(10_000);
  });

  it('rejects non-HTTP destinations', () => {
    const result = destinationPreflightInputSchema.safeParse({
      url: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });
});

describe('syntheticEventInputSchema', () => {
  it('requires explicit confirmation before contacting a real destination', () => {
    expect(syntheticEventInputSchema.safeParse({ confirm: true }).success).toBe(true);
    expect(syntheticEventInputSchema.safeParse({ confirm: false }).success).toBe(false);
  });
});

describe('evidenceExportQuerySchema', () => {
  it('defaults to JSON and accepts Markdown', () => {
    expect(evidenceExportQuerySchema.parse({}).format).toBe('json');
    expect(evidenceExportQuerySchema.parse({ format: 'markdown' }).format).toBe('markdown');
  });

  it('rejects unsupported export formats', () => {
    expect(evidenceExportQuerySchema.safeParse({ format: 'html' }).success).toBe(false);
  });
});
