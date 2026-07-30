import { describe, expect, it, vi } from 'vitest';
import { junitReport, parseTrialConfig, runTrial } from './core.js';
import { downloadAutomationEvidence, runAutomationEvent } from './automation.js';

describe('trial configuration', () => {
  it('uses a secret endpoint override and validates attempts', () => {
    const config = parseTrialConfig(
      'name: Recovery\nendpoint: https://example.invalid\nattempts: [500, 200]',
      { HOOKTRIALS_ENDPOINT_URL: 'https://hooks.example.test/private' },
    );
    expect(config.endpoint).toBe('https://hooks.example.test/private');
    expect(config.attempts.map((attempt) => attempt.expect)).toEqual([500, 200]);
  });
});

describe('automation client', () => {
  it('uses scoped bearer auth for synthetic runs', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          eventId: 'evt-1',
          correlationKey: 'corr-1',
          mode: 'protect',
          statusCode: 202,
          latencyMs: 12,
          destinationTriggered: true,
        }),
        { status: 202 },
      ),
    );
    const result = await runAutomationEvent(
      { apiOrigin: 'https://api.example.test/', apiKey: 'htk_secret', endpointId: 'endpoint-1' },
      fetcher,
    );
    expect(result.eventId).toBe('evt-1');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(
      expect.objectContaining({ authorization: 'Bearer htk_secret' }),
    );
  });

  it('downloads only the redacted evidence response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('# evidence', { status: 200 }));
    await expect(
      downloadAutomationEvidence(
        {
          apiOrigin: 'https://api.example.test',
          apiKey: 'htk_secret',
          eventId: 'evt-1',
          format: 'markdown',
        },
        fetcher,
      ),
    ).resolves.toBe('# evidence');
    expect(fetcher.mock.calls[0]?.[0]).toContain(
      '/v1/automation/events/evt-1/export?format=markdown',
    );
  });
});

describe('trial runner', () => {
  it('keeps one event id and reports exact status mismatches', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    const config = parseTrialConfig('endpoint: https://example.test\nattempts: [500, 200]');
    const result = await runTrial(config, fetcher);
    expect(result.passed).toBe(false);
    expect(result.attempts.map((attempt) => attempt.passed)).toEqual([true, false]);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(
      expect.objectContaining({ 'x-event-id': config.eventId }),
    );
    expect(junitReport(result)).toContain('failures="1"');
  });
});
