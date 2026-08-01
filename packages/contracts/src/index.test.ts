import { describe, expect, it } from 'vitest';
import {
  alertChannelInputSchema,
  auditQuerySchema,
  apiKeyInputSchema,
  createEndpointInputSchema,
  destinationPreflightInputSchema,
  deliveryPolicyInputSchema,
  evidenceExportQuerySchema,
  evidenceListQuerySchema,
  incidentTriageInputSchema,
  reliabilityQuerySchema,
  workspaceInviteAcceptSchema,
  workspaceInviteInputSchema,
  syntheticEventInputSchema,
  updateEndpointInputSchema,
  workspaceRoleUpdateSchema,
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

describe('apiKeyInputSchema', () => {
  it('defaults to least-privilege read access', () => {
    expect(apiKeyInputSchema.parse({ name: 'ci-read' })).toMatchObject({ scopes: ['read'] });
  });

  it('rejects empty or unknown scopes', () => {
    expect(apiKeyInputSchema.safeParse({ name: 'ci', scopes: [] }).success).toBe(false);
    expect(apiKeyInputSchema.safeParse({ name: 'ci', scopes: ['admin'] }).success).toBe(false);
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

  it('accepts the extended provider starter catalog', () => {
    for (const provider of ['gitlab', 'linear', 'hubspot'] as const) {
      const input = createEndpointInputSchema.parse({ name: `${provider}-route`, provider });
      expect(input.provider).toBe(provider);
    }
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

  it('accepts pausing outbound Protect delivery', () => {
    const result = updateEndpointInputSchema.safeParse({ deliveryPaused: true });
    expect(result.success).toBe(true);
  });

  it('accepts a protected fan-out policy without exposing destination data', () => {
    const input = createEndpointInputSchema.parse({
      name: 'fan-out-route',
      mode: 'protect',
      deliveryPolicy: {
        strategy: 'fanout',
        idempotencyScope: 'destination',
        destinations: [
          { name: 'primary', url: 'https://api.example.com/primary' },
          { name: 'audit', url: 'https://audit.example.com/events' },
        ],
      },
    });
    expect(input.deliveryPolicy?.destinations).toHaveLength(2);
  });

  it('requires a fallback for failover and Protect mode for advanced routing', () => {
    expect(
      deliveryPolicyInputSchema.safeParse({
        strategy: 'failover',
        destinations: [{ name: 'primary', url: 'https://api.example.com/primary' }],
      }).success,
    ).toBe(false);
    expect(
      createEndpointInputSchema.safeParse({
        name: 'observe-fan-out',
        mode: 'observe',
        destinationUrl: 'https://api.example.com/primary',
        deliveryPolicy: {
          strategy: 'fanout',
          destinations: [
            { name: 'primary', url: 'https://api.example.com/primary' },
            { name: 'audit', url: 'https://audit.example.com/events' },
          ],
        },
      }).success,
    ).toBe(false);
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

describe('incidentTriageInputSchema', () => {
  it('accepts acknowledgement and bounded operator notes', () => {
    expect(
      incidentTriageInputSchema.parse({
        acknowledged: true,
        note: 'Investigating provider timeout.',
      }),
    ).toEqual({ acknowledged: true, note: 'Investigating provider timeout.' });
  });

  it('accepts assigning and unassigning a workspace member', () => {
    const userId = '00000000-0000-4000-8000-000000000001';
    expect(incidentTriageInputSchema.parse({ assigneeUserId: userId })).toEqual({
      assigneeUserId: userId,
    });
    expect(incidentTriageInputSchema.parse({ assigneeUserId: null })).toEqual({
      assigneeUserId: null,
    });
  });

  it('rejects an empty triage patch and oversized notes', () => {
    expect(incidentTriageInputSchema.safeParse({}).success).toBe(false);
    expect(incidentTriageInputSchema.safeParse({ note: 'x'.repeat(2_001) }).success).toBe(false);
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

describe('evidenceListQuerySchema', () => {
  it('defaults to the newest 50 reports', () => {
    expect(evidenceListQuerySchema.parse({})).toEqual({ limit: 50, status: 'all' });
  });

  it('accepts a bounded status filter and rejects unsupported values', () => {
    expect(evidenceListQuerySchema.parse({ limit: '20', status: 'failed' })).toEqual({
      limit: 20,
      status: 'failed',
    });
    expect(evidenceListQuerySchema.safeParse({ status: 'complete' }).success).toBe(false);
  });
});

describe('operational evidence queries', () => {
  it('bounds audit history and defaults the reliability window', () => {
    expect(auditQuerySchema.parse({})).toMatchObject({ limit: 100 });
    expect(reliabilityQuerySchema.parse({})).toMatchObject({ windowDays: 7, target: 99.9 });
  });

  it('rejects unbounded reliability requests', () => {
    expect(reliabilityQuerySchema.safeParse({ windowDays: 31 }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
  });
});

describe('workspace controls', () => {
  it('accepts bounded member roles and normalizes invite defaults', () => {
    expect(workspaceInviteInputSchema.parse({ email: 'ops@example.com' })).toEqual({
      email: 'ops@example.com',
      role: 'viewer',
    });
    expect(workspaceRoleUpdateSchema.parse({ role: 'operator' }).role).toBe('operator');
  });

  it('rejects owner escalation and malformed invite tokens', () => {
    expect(workspaceRoleUpdateSchema.safeParse({ role: 'owner' }).success).toBe(false);
    expect(workspaceInviteAcceptSchema.safeParse({ token: 'short' }).success).toBe(false);
  });
});
