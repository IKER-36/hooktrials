import { describe, expect, it } from 'vitest';
import {
  computeBackoff,
  idempotencyKey,
  nextFailoverIndex,
  parseRetryAfter,
  retriesExhausted,
} from './index.js';

describe('parseRetryAfter', () => {
  it('parses delta seconds and caps excessive values', () => {
    expect(parseRetryAfter('12', 60_000)).toBe(12_000);
    expect(parseRetryAfter('999', 60_000)).toBe(60_000);
  });

  it('parses HTTP dates against the supplied clock', () => {
    const now = Date.parse('2026-07-13T12:00:00Z');
    expect(parseRetryAfter('Mon, 13 Jul 2026 12:00:10 GMT', 60_000, now)).toBe(10_000);
  });

  it('rejects invalid and past values', () => {
    expect(parseRetryAfter('invalid', 60_000)).toBeNull();
    expect(parseRetryAfter('-2', 60_000)).toBeNull();
  });
});

describe('computeBackoff', () => {
  it('uses bounded exponential backoff', () => {
    expect(computeBackoff(1, 2_000, 30_000, () => 0.5)).toBe(2_000);
    expect(computeBackoff(4, 2_000, 10_000, () => 0.5)).toBe(10_000);
  });

  it('adds bounded jitter', () => {
    expect(computeBackoff(2, 2_000, 30_000, () => 0)).toBe(3_200);
    expect(computeBackoff(2, 2_000, 30_000, () => 1)).toBe(4_800);
  });
});

describe('retriesExhausted', () => {
  it('exhausts exactly at the configured maximum', () => {
    expect(retriesExhausted(4, 5)).toBe(false);
    expect(retriesExhausted(5, 5)).toBe(true);
  });
});

describe('delivery policy helpers', () => {
  it('keeps idempotency stable across attempts and scopes fan-out destinations', () => {
    const hash = (value: string) => `hash:${value}`;
    expect(idempotencyKey('evt_1', 'primary', 'destination', hash)).toBe('hash:evt_1:primary');
    expect(idempotencyKey('evt_1', 'fallback', 'destination', hash)).toBe('hash:evt_1:fallback');
    expect(idempotencyKey('evt_1', 'fallback', 'event', hash)).toBe('hash:evt_1');
  });

  it('moves through failover destinations and stops at the last one', () => {
    expect(nextFailoverIndex('failover', 0, 3)).toBe(1);
    expect(nextFailoverIndex('failover', 1, 3)).toBe(2);
    expect(nextFailoverIndex('failover', 2, 3)).toBeNull();
    expect(nextFailoverIndex('fanout', 0, 3)).toBeNull();
  });
});
