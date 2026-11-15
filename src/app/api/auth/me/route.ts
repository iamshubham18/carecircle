import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import type { Household, PermissionsMatrix } from '@/lib/types';
import { DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Fetch household details
    const householdDoc = await adminDb.collection('households').doc(session.householdId).get();
    const householdData = householdDoc.exists ? (householdDoc.data() as Household) : null;

    // Fetch permissions matrix
    const permDoc = await adminDb.collection('permissions').doc(session.householdId).get();
    const permissions: PermissionsMatrix = permDoc.exists
      ? (permDoc.data() as PermissionsMatrix)
      : DEFAULT_PERMISSIONS_MATRIX;

    return NextResponse.json({
      ok: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        householdId: session.householdId,
      },
      household: householdData
        ? {
            id: householdData.id,
            name: householdData.name,
            code: householdData.code,
          }
        : null,
      permissions,
    });
  } catch (_error: unknown) {
    return NextResponse.json(
      { ok: false, error: 'Unable to retrieve session', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
