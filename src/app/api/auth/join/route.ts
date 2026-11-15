import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase';
import { joinHouseholdSchema } from '@/lib/validators';
import {
  hashPin,
  verifyPin,
  signSessionToken,
  getAuthCookieOptions,
  AUTH_COOKIE_NAME,
} from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import type { Household, Member } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Rate limiting
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(`auth:join:${ip}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again shortly.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // 2. Body validation
    const rawBody = await request.json().catch(() => null);
    const parseResult = joinHouseholdSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.errors[0]?.message || 'Invalid input data',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { code, name, email, role, pin } = parseResult.data;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.toUpperCase().trim();

    // 3. Find household by code
    const householdSnap = await adminDb
      .collection('households')
      .where('code', '==', normalizedCode)
      .limit(1)
      .get();

    if (householdSnap.empty || !householdSnap.docs[0]) {
      // Generic error message for security
      return NextResponse.json(
        { error: 'Invalid household code or member details.', code: 'INVALID_CREDENTIALS' },
        { status: 404 }
      );
    }

    const householdDoc = householdSnap.docs[0];
    const household = householdDoc.data() as Household;

    // 4. Check if member already exists in this household
    const memberSnap = await adminDb
      .collection('members')
      .where('householdId', '==', household.id)
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    let member: Member;

    if (!memberSnap.empty && memberSnap.docs[0]) {
      const existingMember = memberSnap.docs[0].data() as Member;
      const isValidPin = await verifyPin(pin, existingMember.pinHash);
      if (!isValidPin) {
        return NextResponse.json(
          { error: 'Invalid household code or member details.', code: 'INVALID_CREDENTIALS' },
          { status: 401 }
        );
      }
      member = existingMember;
    } else {
      // New member joining household
      const pinHash = await hashPin(pin);
      const memberRef = adminDb.collection('members').doc();
      const nowUtc = new Date().toISOString();

      member = {
        id: memberRef.id,
        householdId: household.id,
        name: name.trim(),
        email: normalizedEmail,
        role,
        pinHash,
        createdAt: nowUtc,
      };

      await memberRef.set(member);
    }

    // 5. Sign JWT session token
    const token = await signSessionToken({
      userId: member.id,
      householdId: household.id,
      role: member.role,
      name: member.name,
      email: member.email,
    });

    // 6. Response with httpOnly cookie
    const response = NextResponse.json(
      {
        ok: true,
        household: {
          id: household.id,
          name: household.name,
          code: household.code,
        },
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
        },
      },
      { status: 200 }
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
