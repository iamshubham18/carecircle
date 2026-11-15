import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { writeAudit } from '@/lib/audit';
import type { DoseLog, PermissionsMatrix } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = context.params;
    const doseRef = adminDb.collection('doseLogs').doc(id);
    const doseSnap = await doseRef.get();

    if (!doseSnap.exists) {
      return NextResponse.json({ error: 'Dose log not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const dose = doseSnap.data() as DoseLog;
    // IDOR Protection: verify dose belongs to authenticated user's household
    if (dose.householdId !== session.householdId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Elders can always mark doses; other roles require editMeds permission
    if (session.role !== 'elder') {
      const permSnap = await adminDb.collection('permissions').doc(session.householdId).get();
      const permissions: PermissionsMatrix = permSnap.exists
        ? (permSnap.data() as PermissionsMatrix)
        : DEFAULT_PERMISSIONS_MATRIX;

      if (!can(session.role, 'editMeds', permissions)) {
        return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
      }
    }

    const nowUtc = new Date().toISOString();
    const updateData = {
      status: 'taken' as const,
      takenAt: nowUtc,
      takenBy: session.userId,
    };

    await doseRef.update(updateData);

    const updatedDose: DoseLog = {
      ...dose,
      ...updateData,
    };

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'take_dose',
      entity: 'dose',
      entityId: dose.id,
      summary: `Marked dose for medication ${dose.medicationId} as taken`,
    });

    return NextResponse.json({ ok: true, dose: updatedDose });
  } catch (error: unknown) {
    console.error('[POST /api/doses/[id]/take] Error:', error);
    return NextResponse.json(
      { error: 'Failed to record dose', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
