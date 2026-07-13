import { describe, expect, it } from 'vitest';
import { decryptValue, encryptValue, sha256 } from './index.js';

describe('encrypted values', () => {
  it('round-trips binary payloads', () => {
    const original = Buffer.from([0, 1, 2, 255, 128]);
    const encrypted = encryptValue(original, 'test-secret-at-least-32-characters');
    expect(decryptValue(encrypted, 'test-secret-at-least-32-characters')).toEqual(original);
  });

  it('round-trips an empty payload', () => {
    const secret = 'test-secret-at-least-32-characters';
    const encrypted = encryptValue(Buffer.alloc(0), secret);

    expect(encrypted.endsWith('.')).toBe(true);
    expect(decryptValue(encrypted, secret)).toEqual(Buffer.alloc(0));
  });

  it('uses a random IV for every encryption', () => {
    const secret = 'test-secret-at-least-32-characters';
    expect(encryptValue('same payload', secret)).not.toBe(encryptValue('same payload', secret));
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptValue('payload', 'test-secret-at-least-32-characters');
    expect(() => decryptValue(`${encrypted}x`, 'test-secret-at-least-32-characters')).toThrow();
  });
});

describe('sha256', () => {
  it('hashes strings deterministically', () => {
    expect(sha256('hooktrials')).toBe(sha256(Buffer.from('hooktrials')));
  });
});
