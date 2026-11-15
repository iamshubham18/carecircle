import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import {
  generateDoses,
  detectMissedDoses,
  getLocalDateString,
  localTimeToUtc,
  addDays,
} from '@/lib/schedule';
import type { DoseLog, Medication, PermissionsMatrix } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const targetDate = url.searchParams.get('date') || getLocalDateString(new Date());

    // 1. Fetch medications for this household with single where clause
    const medsSnap = await adminDb
      .collection('medications')
      .where('householdId', '==', session.householdId)
      .get();

    // Filter active medications in JavaScript to avoid composite index requirements
    const medications = medsSnap.docs
      .map((doc) => doc.data() as Medication)
      .filter((med) => med.active !== false);

    // 2. Fetch all dose logs for this household with single where clause
    // (Filtering by scheduledAt range in JavaScript prevents FAILED_PRECONDITION composite index error)
    const dosesSnap = await adminDb
      .collection('doseLogs')
      .where('householdId', '==', session.householdId)
      .get();

    const dayStartUtc = localTimeToUtc(targetDate, '00:00');
    const dayEndUtc = localTimeToUtc(addDays(targetDate, 1), '00:00');

    const allHouseholdDoses = dosesSnap.docs.map((d) => d.data() as DoseLog);

    // Filter doses for target date in JavaScript
    const existingDoses = allHouseholdDoses.filter(
      (d) => d.scheduledAt >= dayStartUtc && d.scheduledAt < dayEndUtc
    );
    const existingIds = new Set(existingDoses.map((d) => d.id));

    // 3. Check for any missing dose logs and create them
    const missingDoses: DoseLog[] = [];
    for (const med of medications) {
      const generated = generateDoses(med, targetDate, 1);
      for (const dose of generated) {
        if (!existingIds.has(dose.id)) {
          missingDoses.push(dose);
          existingDoses.push(dose);
        }
      }
    }

    if (missingDoses.length > 0) {
      const batch = adminDb.batch();
      for (const dose of missingDoses) {
        const ref = adminDb.collection('doseLogs').doc(dose.id);
        // Omit any undefined values so Firestore does not reject the document
        const cleanDoseData: Record<string, unknown> = {
          id: dose.id,
          householdId: dose.householdId,
          medicationId: dose.medicationId,
          scheduledAt: dose.scheduledAt,
          status: dose.status,
        };
        if (dose.takenAt) cleanDoseData.takenAt = dose.takenAt;
        if (dose.takenBy) cleanDoseData.takenBy = dose.takenBy;
        if (dose.reminderSentAt) cleanDoseData.reminderSentAt = dose.reminderSentAt;
        if (dose.escalatedAt) cleanDoseData.escalatedAt = dose.escalatedAt;

        batch.set(ref, cleanDoseData);
      }
      await batch.commit();
    }

    // 4. Detect any pending doses that are now missed (past grace period)
    const nowUtc = new Date().toISOString();
    const pendingDoses = existingDoses.filter((d) => d.status === 'pending');
    const newlyMissed = detectMissedDoses(pendingDoses, nowUtc, 30);

    if (newlyMissed.length > 0) {
      const batch = adminDb.batch();
      for (const missed of newlyMissed) {
        const ref = adminDb.collection('doseLogs').doc(missed.id);
        batch.update(ref, { status: 'missed' });
        const local = existingDoses.find((d) => d.id === missed.id);
        if (local) local.status = 'missed';
      }
      await batch.commit();
    }

    // 5. Join medication details (name, dose, notes) for easy UI rendering
    const medMap = new Map(medications.map((m) => [m.id, m]));
    const enrichedDoses = existingDoses
      .map((dose) => {
        const med = medMap.get(dose.medicationId);
        return {
          ...dose,
          medicationName: med?.name || 'Unknown Medication',
          medicationDose: med?.dose || '',
          medicationNotes: med?.notes || '',
        };
      })
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

    return NextResponse.json({ ok: true, date: targetDate, doses: enrichedDoses });
  } catch (error: unknown) {
    console.error('[GET /api/doses] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve doses', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
