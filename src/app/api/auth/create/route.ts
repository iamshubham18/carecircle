import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase';
import { createHouseholdSchema } from '@/lib/validators';
import {
  hashPin,
  generateHouseholdCode,
  signSessionToken,
  getAuthCookieOptions,
  AUTH_COOKIE_NAME,
} from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import type { Household, Member } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`auth:create:${ip}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again shortly.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // 2. Body validation
    const rawBody = await request.json().catch(() => null);
    const parseResult = createHouseholdSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.errors[0]?.message || 'Invalid input data',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { householdName, elderName, elderEmail, pin } = parseResult.data;
    const normalizedEmail = elderEmail.toLowerCase().trim();

    // 3. Generate unique household code
    let householdCode = generateHouseholdCode();
    // Ensure uniqueness
    const existingCodeSnap = await adminDb
      .collection('households')
      .where('code', '==', householdCode)
      .limit(1)
      .get();

    if (!existingCodeSnap.empty) {
      householdCode = generateHouseholdCode();
    }

    // 4. Hash elder PIN
    const pinHash = await hashPin(pin);
    const nowUtc = new Date().toISOString();

    const householdRef = adminDb.collection('households').doc();
    const memberRef = adminDb.collection('members').doc();

    const householdData: Household = {
      id: householdRef.id,
      name: householdName.trim(),
      code: householdCode,
      elderId: memberRef.id,
      createdAt: nowUtc,
    };

    const memberData: Member = {
      id: memberRef.id,
      householdId: householdRef.id,
      name: elderName.trim(),
      email: normalizedEmail,
      role: 'elder',
      pinHash,
      createdAt: nowUtc,
    };

    // 5. Atomic Batch write
    const batch = adminDb.batch();
    batch.set(householdRef, householdData);
    batch.set(memberRef, memberData);
    batch.set(adminDb.collection('permissions').doc(householdRef.id), DEFAULT_PERMISSIONS_MATRIX);
    await batch.commit();

    // 6. Sign JWT session
    const token = await signSessionToken({
      userId: memberData.id,
      householdId: householdData.id,
      role: 'elder',
      name: memberData.name,
      email: memberData.email,
    });

    // 7. Response with httpOnly cookie
    const response = NextResponse.json(
      {
        ok: true,
        household: {
          id: householdData.id,
          name: householdData.name,
          code: householdData.code,
        },
        member: {
          id: memberData.id,
          name: memberData.name,
          email: memberData.email,
          role: memberData.role,
        },
      },
      { status: 201 }
    );

    response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
    return response;
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
