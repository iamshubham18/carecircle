import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { calculateAdherenceSummary } from '@/lib/adherence';
import type { DoseLog, PermissionsMatrix } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const permSnap = await adminDb.collection('permissions').doc(session.householdId).get();
    const permissions: PermissionsMatrix = permSnap.exists
      ? (permSnap.data() as PermissionsMatrix)
      : DEFAULT_PERMISSIONS_MATRIX;

    if (!can(session.role, 'viewAdherence', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Query doses for household with single where clause to prevent composite index error
    const dosesSnap = await adminDb
      .collection('doseLogs')
      .where('householdId', '==', session.householdId)
      .get();

    const thirtyDaysAgoUtc = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const doses: DoseLog[] = dosesSnap.docs
      .map((doc) => doc.data() as DoseLog)
      .filter((d) => d.scheduledAt >= thirtyDaysAgoUtc);

    const summary = calculateAdherenceSummary(doses);

    return NextResponse.json({ ok: true, summary });
  } catch (error: unknown) {
    console.error('[GET /api/adherence] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate adherence', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
