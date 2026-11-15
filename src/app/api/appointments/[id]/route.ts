import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { updateAppointmentSchema } from '@/lib/validators';
import { writeAudit } from '@/lib/audit';
import type { Appointment, PermissionsMatrix } from '@/lib/types';

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
    const docRef = adminDb.collection('appointments').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Appointment not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const appt = snap.data() as Appointment;
    if (appt.householdId !== session.householdId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const permSnap = await adminDb.collection('permissions').doc(session.householdId).get();
    const permissions: PermissionsMatrix = permSnap.exists
      ? (permSnap.data() as PermissionsMatrix)
      : DEFAULT_PERMISSIONS_MATRIX;

    if (!can(session.role, 'viewAppointments', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    return NextResponse.json({ ok: true, appointment: appt });
  } catch (error: unknown) {
    console.error('[GET /api/appointments/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointment', code: 'INTERNAL_ERROR' },
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

    if (!can(session.role, 'editAppointments', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = context.params;
    const docRef = adminDb.collection('appointments').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Appointment not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const currentAppt = snap.data() as Appointment;
    if (currentAppt.householdId !== session.householdId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const parseResult = updateAppointmentSchema.safeParse(rawBody);
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

    if (updates.doctor !== undefined) cleanUpdates.doctor = updates.doctor.trim();
    if (updates.datetime !== undefined) cleanUpdates.datetime = updates.datetime;
    if (updates.location !== undefined) cleanUpdates.location = updates.location.trim();
    if (updates.notes !== undefined) cleanUpdates.notes = updates.notes || null;

    await docRef.update(cleanUpdates);

    const updated = { ...currentAppt, ...updates };

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'update',
      entity: 'appointment',
      entityId: id,
      summary: `Updated appointment with ${currentAppt.doctor}`,
    });

    return NextResponse.json({ ok: true, appointment: updated });
  } catch (error: unknown) {
    console.error('[PATCH /api/appointments/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update appointment', code: 'INTERNAL_ERROR' },
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

    if (!can(session.role, 'editAppointments', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const { id } = context.params;
    const docRef = adminDb.collection('appointments').doc(id);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Appointment not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    const currentAppt = snap.data() as Appointment;
    if (currentAppt.householdId !== session.householdId) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    await docRef.delete();

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'delete',
      entity: 'appointment',
      entityId: id,
      summary: `Cancelled appointment with ${currentAppt.doctor}`,
    });

    return NextResponse.json({ ok: true, message: 'Appointment deleted' });
  } catch (error: unknown) {
    console.error('[DELETE /api/appointments/[id]] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete appointment', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
