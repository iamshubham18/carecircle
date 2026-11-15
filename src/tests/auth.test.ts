import { describe, it, expect } from 'vitest';
import {
  hashPin,
  verifyPin,
  signSessionToken,
  verifySessionToken,
  generateHouseholdCode,
} from '@/lib/auth';
import type { SessionData } from '@/lib/types';
import { SignJWT } from 'jose';

describe('auth.ts logic & cryptographic security', () => {
  it('hashes a PIN and successfully verifies the correct PIN', async () => {
    const pin = '1234';
    const hash = await hashPin(pin);

    expect(typeof hash).toBe('string');
    expect(hash).not.toBe(pin);

    const isMatch = await verifyPin(pin, hash);
    expect(isMatch).toBe(true);
  });

  it('rejects an incorrect PIN against the hash', async () => {
    const pin = '5678';
    const hash = await hashPin(pin);

    const isMatch = await verifyPin('0000', hash);
    expect(isMatch).toBe(false);
  });

  it('generates salted unique hashes for the same PIN', async () => {
    const pin = '9999';
    const hash1 = await hashPin(pin);
    const hash2 = await hashPin(pin);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPin(pin, hash1)).toBe(true);
    expect(await verifyPin(pin, hash2)).toBe(true);
  });

  it('generates an 8-character unique uppercase household code', () => {
    const code = generateHouseholdCode();
    expect(code).toHaveLength(8);
    expect(/^[A-Z0-9]{8}$/.test(code)).toBe(true);
    // Should not contain ambiguous 0, O, 1, I
    expect(/[0O1I]/.test(code)).toBe(false);
  });

  it('signs and verifies a valid JWT session token', async () => {
    const session: SessionData = {
      userId: 'user_123',
      householdId: 'house_456',
      role: 'elder',
      name: 'Elder Person',
      email: 'elder@carecircle.local',
    };

    const token = await signSessionToken(session);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(session.userId);
    expect(decoded?.householdId).toBe(session.householdId);
    expect(decoded?.role).toBe(session.role);
    expect(decoded?.email).toBe(session.email);
  });

  it('returns null when verifying a tampered or invalid token', async () => {
    const session: SessionData = {
      userId: 'user_123',
      householdId: 'house_456',
      role: 'caretaker',
      name: 'Care Taker',
      email: 'care@carecircle.local',
    };

    const token = await signSessionToken(session);
    const tampered = token + 'tampered';

    const decoded = await verifySessionToken(tampered);
    expect(decoded).toBeNull();
  });

  it('returns null when verifying an expired token', async () => {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'carecircle_development_secret_key_at_least_32_chars_long!'
    );

    // Create a token that expired 10 seconds ago
    const expiredToken = await new SignJWT({
      userId: 'user_expired',
      householdId: 'house_123',
      role: 'family',
      name: 'Family Member',
      email: 'fam@carecircle.local',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 60)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);

    const decoded = await verifySessionToken(expiredToken);
    expect(decoded).toBeNull();
  });
});
