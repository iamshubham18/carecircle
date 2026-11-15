import type { SessionData } from './types';

/**
 * Placeholder for PIN hashing and verification (Phase 1)
 */
export async function hashPin(_pin: string): Promise<string> {
  // To be implemented with bcryptjs in Phase 1
  return 'hashed_pin_placeholder';
}

export async function verifyPin(_pin: string, _hash: string): Promise<boolean> {
  // To be implemented with bcryptjs in Phase 1
  return false;
}

/**
 * Placeholder for JWT signing and verification (Phase 1)
 */
export async function signSessionToken(_session: SessionData): Promise<string> {
  // To be implemented with jose in Phase 1
  return 'jwt_placeholder';
}

export async function verifySessionToken(_token: string): Promise<SessionData | null> {
  // To be implemented with jose in Phase 1
  return null;
}

export async function getSession(): Promise<SessionData | null> {
  // To be implemented in Phase 1
  return null;
}
