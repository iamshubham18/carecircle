import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { medicationSchema } from '@/lib/validators';
import { generateDoses, getLocalDateString } from '@/lib/schedule';
import { writeAudit } from '@/lib/audit';
import type { Medication, PermissionsMatrix } from '@/lib/types';

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

    if (!can(session.role, 'viewMeds', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    // Query with single where clause to prevent composite index requirements
    const snap = await adminDb
      .collection('medications')
      .where('householdId', '==', session.householdId)
      .get();

    // Filter active medications in JavaScript
    const medications: Medication[] = snap.docs
      .map((doc) => doc.data() as Medication)
      .filter((med) => med.active !== false);

    return NextResponse.json({ ok: true, medications });
  } catch (error: unknown) {
    console.error('[GET /api/medications] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch medications', code: 'INTERNAL_ERROR' },
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

    if (!can(session.role, 'editMeds', permissions)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    const parseResult = medicationSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.errors[0]?.message || 'Invalid medication data',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const docRef = adminDb.collection('medications').doc();

    // Avoid undefined values in Firestore document
    const medication: Medication = {
      id: docRef.id,
      householdId: session.householdId,
      name: data.name.trim(),
      dose: data.dose.trim(),
      times: data.times,
      startDate: data.startDate,
      endDate: data.endDate || undefined,
      notes: data.notes || undefined,
      active: true,
      createdBy: session.userId,
    };

    const firestoreMedData: Record<string, unknown> = {
      id: docRef.id,
      householdId: session.householdId,
      name: data.name.trim(),
      dose: data.dose.trim(),
      times: data.times,
      startDate: data.startDate,
      endDate: data.endDate || null,
      notes: data.notes || null,
      active: true,
      createdBy: session.userId,
    };

    // Generate dose schedule slots for today + 7 days
    const todayStr = getLocalDateString(new Date());
    const initialStartDate = data.startDate > todayStr ? data.startDate : todayStr;
    const generatedDoses = generateDoses(medication, initialStartDate, 7);

    // Atomic batch save medication + dose logs
    const batch = adminDb.batch();
    batch.set(docRef, firestoreMedData);

    for (const dose of generatedDoses) {
      const doseRef = adminDb.collection('doseLogs').doc(dose.id);
      const cleanDose: Record<string, unknown> = {
        id: dose.id,
        householdId: dose.householdId,
        medicationId: dose.medicationId,
        scheduledAt: dose.scheduledAt,
        status: dose.status,
      };
      batch.set(doseRef, cleanDose);
    }

    await batch.commit();

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'create',
      entity: 'medication',
      entityId: medication.id,
      summary: `Added medication ${medication.name} (${medication.dose})`,
    });

    return NextResponse.json({ ok: true, medication }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/medications] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create medication', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
