import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { appointmentSchema } from '@/lib/validators';
import { writeAudit } from '@/lib/audit';
import type { Appointment, PermissionsMatrix } from '@/lib/types';

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

    if (!can(session.role, 'viewAppointments', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const snap = await adminDb
      .collection('appointments')
      .where('householdId', '==', session.householdId)
      .get();

    const appointments: Appointment[] = snap.docs
      .map((doc) => doc.data() as Appointment)
      .sort((a, b) => a.datetime.localeCompare(b.datetime));

    return NextResponse.json({ ok: true, appointments });
  } catch (error: unknown) {
    console.error('[GET /api/appointments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
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

    const rawBody = await request.json().catch(() => null);
    const parseResult = appointmentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.errors[0]?.message || 'Invalid appointment data',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const docRef = adminDb.collection('appointments').doc();

    const appointment: Appointment = {
      id: docRef.id,
      householdId: session.householdId,
      doctor: data.doctor.trim(),
      datetime: data.datetime,
      location: data.location.trim(),
      notes: data.notes || undefined,
      createdBy: session.userId,
    };

    // Use null instead of undefined for Firestore document values
    const firestoreApptData: Record<string, unknown> = {
      id: docRef.id,
      householdId: session.householdId,
      doctor: data.doctor.trim(),
      datetime: data.datetime,
      location: data.location.trim(),
      notes: data.notes || null,
      createdBy: session.userId,
      createdAt: new Date().toISOString(),
    };

    await docRef.set(firestoreApptData);

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'create',
      entity: 'appointment',
      entityId: appointment.id,
      summary: `Scheduled appointment with ${appointment.doctor} at ${appointment.location}`,
    });

    return NextResponse.json({ ok: true, appointment }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/appointments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
