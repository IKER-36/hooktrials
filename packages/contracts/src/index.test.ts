import { describe, expect, it } from 'vitest';
import { createEndpointInputSchema } from './index.js';

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
