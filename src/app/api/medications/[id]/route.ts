import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { updateMedicationSchema } from '@/lib/validators';
import { writeAudit } from '@/lib/audit';
import type { Medication, PermissionsMatrix } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = context.params;
    const docRef = adminDb.collection('medications').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Medication not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const med = snap.data() as Medication;
    if (med.householdId !== session.householdId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const permSnap = await adminDb.collection('permissions').doc(session.householdId).get();
    const permissions: PermissionsMatrix = permSnap.exists
      ? (permSnap.data() as PermissionsMatrix)
      : DEFAULT_PERMISSIONS_MATRIX;

    if (!can(session.role, 'viewMeds', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, medication: med });
  } catch (error: unknown) {
    console.error('[GET /api/medications/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch medication', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const permSnap = await adminDb.collection('permissions').doc(session.householdId).get();
    const permissions: PermissionsMatrix = permSnap.exists
      ? (permSnap.data() as PermissionsMatrix)
      : DEFAULT_PERMISSIONS_MATRIX;

    if (!can(session.role, 'editMeds', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = context.params;
    const docRef = adminDb.collection('medications').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Medication not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const currentMed = snap.data() as Medication;
    if (currentMed.householdId !== session.householdId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const parseResult = updateMedicationSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.errors[0]?.message || 'Invalid input data',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const updates = parseResult.data;
    const cleanUpdates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
    if (updates.dose !== undefined) cleanUpdates.dose = updates.dose.trim();
    if (updates.times !== undefined) cleanUpdates.times = updates.times;
    if (updates.startDate !== undefined) cleanUpdates.startDate = updates.startDate;
    if (updates.endDate !== undefined) cleanUpdates.endDate = updates.endDate || null;
    if (updates.notes !== undefined) cleanUpdates.notes = updates.notes || null;
    if (updates.active !== undefined) cleanUpdates.active = updates.active;

    await docRef.update(cleanUpdates);

    const updatedMed = { ...currentMed, ...updates };

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'update',
      entity: 'medication',
      entityId: id,
      summary: `Updated medication ${currentMed.name}`,
    });

    return NextResponse.json({ ok: true, medication: updatedMed });
  } catch (error: unknown) {
    console.error('[PATCH /api/medications/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update medication', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const permSnap = await adminDb.collection('permissions').doc(session.householdId).get();
    const permissions: PermissionsMatrix = permSnap.exists
      ? (permSnap.data() as PermissionsMatrix)
      : DEFAULT_PERMISSIONS_MATRIX;

    if (!can(session.role, 'editMeds', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = context.params;
    const docRef = adminDb.collection('medications').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Medication not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const currentMed = snap.data() as Medication;
    if (currentMed.householdId !== session.householdId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    await docRef.update({
      active: false,
      deactivatedAt: new Date().toISOString(),
    });

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'delete',
      entity: 'medication',
      entityId: id,
      summary: `Deactivated medication ${currentMed.name}`,
    });

    return NextResponse.json({ ok: true, message: 'Medication deactivated' });
  } catch (error: unknown) {
    console.error('[DELETE /api/medications/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate medication', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
