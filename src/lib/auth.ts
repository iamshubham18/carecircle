import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { SessionData } from './types';

export const AUTH_COOKIE_NAME = 'auth_token';

// Secret key for JWT signing - must be at least 32 characters
const DEFAULT_DEV_SECRET = 'carecircle_development_secret_key_at_least_32_chars_long!';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
  return new TextEncoder().encode(secret);
}

/**
 * Hashes a 4-6 digit numeric PIN using bcryptjs
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
}

/**
 * Verifies a raw PIN against the stored bcrypt hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

/**
 * Generates an 8-character unique alphanumeric household code (e.g. 'ABC123XY')
 */
export function generateHouseholdCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude ambiguous chars like 0/O, 1/I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Signs a session JWT using jose (HMAC SHA-256)
 */
export async function signSessionToken(session: SessionData): Promise<string> {
  return new SignJWT({
    userId: session.userId,
    householdId: session.householdId,
    role: session.role,
    name: session.name,
    email: session.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getJwtSecret());
}

/**
 * Verifies and decodes a session JWT token
 */
export async function verifySessionToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.userId === 'string' &&
      typeof payload.householdId === 'string' &&
      typeof payload.role === 'string' &&
      typeof payload.name === 'string' &&
      typeof payload.email === 'string'
    ) {
      return {
        userId: payload.userId,
        householdId: payload.householdId,
        role: payload.role as SessionData['role'],
        name: payload.name,
        email: payload.email,
      };
    }
    return null;
  } catch (_error: unknown) {
    return null;
  }
}

/**
 * Retrieves the authenticated session from cookies in server components or route handlers
 */
export async function getSession(req?: NextRequest): Promise<SessionData | null> {
  try {
    let token: string | undefined;

    if (req) {
      token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    } else {
      const cookieStore = cookies();
      token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    }

    if (!token) return null;
    return await verifySessionToken(token);
  } catch (_error: unknown) {
    return null;
  }
}

/**
 * Standard cookie configuration for session cookie
 */
export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}
