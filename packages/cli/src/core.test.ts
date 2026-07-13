import { describe, expect, it, vi } from 'vitest';
import { junitReport, parseTrialConfig, runTrial } from './core.js';

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
