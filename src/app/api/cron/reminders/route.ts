import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase';
import {
  findUpcomingDoses,
  findOverdueDosesToMarkMissed,
  findMissedDosesToEscalate,
  findAppointmentsNeedingReminder,
  formatUtcToLocalTime,
  formatUtcToLocalDateTime,
  getLookaheadMinutes,
  getGraceMinutes,
  getEscalationMinutes,
} from '@/lib/schedule';
import {
  renderUpcomingDoseEmail,
  renderMissedDoseEmail,
  renderCaretakerEscalationEmail,
  renderAppointmentReminderEmail,
  sendEmail,
} from '@/lib/mailer';
import type { Household, Member, Medication, DoseLog, Appointment } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Validates the x-cron-secret header against CRON_SECRET env variable
 */
function isCronAuthorized(request: Request): boolean {
  const secretHeader = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const validSecret = process.env.CRON_SECRET;
  if (!validSecret) {
    return false;
  }

  return secretHeader === validSecret || bearerSecret === validSecret;
}

/**
 * Core engine for scheduled reminder dispatch and escalation
 */
async function processCronReminders() {
  const nowUtc = new Date().toISOString();
  const lookaheadMinutes = getLookaheadMinutes();
  const graceMinutes = getGraceMinutes();
  const escalationMinutes = getEscalationMinutes();

  let householdsProcessed = 0;
  let upcomingDosesReminded = 0;
  let dosesMarkedMissed = 0;
  let dosesEscalated = 0;
  let appointmentsReminded = 0;

  // 1. Fetch all households
  const householdsSnap = await adminDb.collection('households').get();

  for (const hDoc of householdsSnap.docs) {
    const household = hDoc.data() as Household;
    householdsProcessed++;

    // 2. Fetch members for this household using single where filter
    const membersSnap = await adminDb
      .collection('members')
      .where('householdId', '==', household.id)
      .get();

    const members: Member[] = membersSnap.docs.map((doc) => doc.data() as Member);
    const elder = members.find((m) => m.role === 'elder');
    const caretakers = members.filter((m) => m.role === 'caretaker');

    // 3. Fetch active medications for this household
    const medsSnap = await adminDb
      .collection('medications')
      .where('householdId', '==', household.id)
      .get();

    const medications: Medication[] = medsSnap.docs
      .map((doc) => doc.data() as Medication)
      .filter((m) => m.active !== false);

    const medMap = new Map(medications.map((m) => [m.id, m]));

    // 4. Fetch dose logs for this household
    const dosesSnap = await adminDb
      .collection('doseLogs')
      .where('householdId', '==', household.id)
      .get();

    const doses: DoseLog[] = dosesSnap.docs.map((doc) => doc.data() as DoseLog);

    // -------------------------------------------------------------
    // Task A: Upcoming Doses due in next lookaheadMinutes without reminder
    // -------------------------------------------------------------
    const upcoming = findUpcomingDoses(doses, nowUtc, lookaheadMinutes);
    for (const dose of upcoming) {
      const med = medMap.get(dose.medicationId);
      if (elder && elder.email) {
        const localTime = formatUtcToLocalTime(dose.scheduledAt);
        const email = renderUpcomingDoseEmail({
          elderName: elder.name,
          medicationName: med?.name || 'Medication',
          dose: med?.dose || '',
          scheduledTime: localTime,
          notes: med?.notes,
        });

        await sendEmail({
          to: elder.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
      }

      // Idempotency update: mark reminderSentAt
      await adminDb.collection('doseLogs').doc(dose.id).update({
        reminderSentAt: nowUtc,
      });

      dose.reminderSentAt = nowUtc;
      upcomingDosesReminded++;
    }

    // -------------------------------------------------------------
    // Task B: Overdue Doses past graceMinutes window -> mark missed
    // -------------------------------------------------------------
    const overdue = findOverdueDosesToMarkMissed(doses, nowUtc, graceMinutes);
    for (const dose of overdue) {
      const med = medMap.get(dose.medicationId);
      if (elder && elder.email) {
        const localTime = formatUtcToLocalTime(dose.scheduledAt);
        const email = renderMissedDoseEmail({
          elderName: elder.name,
          medicationName: med?.name || 'Medication',
          dose: med?.dose || '',
          scheduledTime: localTime,
        });

        await sendEmail({
          to: elder.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
      }

      // Transition status to 'missed'
      await adminDb.collection('doseLogs').doc(dose.id).update({
        status: 'missed',
      });

      dose.status = 'missed';
      dosesMarkedMissed++;
    }

    // -------------------------------------------------------------
    // Task C: Escalation to Caretakers (graceMinutes + escalationMinutes)
    // -------------------------------------------------------------
    const toEscalate = findMissedDosesToEscalate(doses, nowUtc, escalationMinutes, graceMinutes);
    for (const dose of toEscalate) {
      const med = medMap.get(dose.medicationId);
      const localTime = formatUtcToLocalTime(dose.scheduledAt);

      for (const caretaker of caretakers) {
        if (caretaker.email) {
          const email = renderCaretakerEscalationEmail({
            caretakerName: caretaker.name,
            elderName: elder ? elder.name : 'Elder',
            medicationName: med?.name || 'Medication',
            dose: med?.dose || '',
            scheduledTime: localTime,
          });

          await sendEmail({
            to: caretaker.email,
            subject: email.subject,
            text: email.text,
            html: email.html,
          });
        }
      }

      // Idempotency update: mark escalatedAt
      await adminDb.collection('doseLogs').doc(dose.id).update({
        escalatedAt: nowUtc,
      });

      dose.escalatedAt = nowUtc;
      dosesEscalated++;
    }

    // -------------------------------------------------------------
    // Task D: Doctor Appointment Reminders (24h and 2h before)
    // -------------------------------------------------------------
    const apptsSnap = await adminDb
      .collection('appointments')
      .where('householdId', '==', household.id)
      .get();

    const appointments: Appointment[] = apptsSnap.docs.map(
      (doc) => doc.data() as Appointment
    );

    const apptTargets = findAppointmentsNeedingReminder(appointments, nowUtc);
    for (const target of apptTargets) {
      const appt = target.appointment;
      const formattedTime = formatUtcToLocalDateTime(appt.datetime);
      const recipients = [elder, ...caretakers].filter((m): m is Member => !!m && !!m.email);

      for (const recipient of recipients) {
        const email = renderAppointmentReminderEmail({
          recipientName: recipient.name,
          doctor: appt.doctor,
          formattedDatetime: formattedTime,
          location: appt.location,
          notes: appt.notes,
          hoursNotice: target.noticeLabel,
        });

        await sendEmail({
          to: recipient.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
      }

      // Idempotency update for appointment
      const updateData: Record<string, string> = {
        reminderSentAt: nowUtc,
      };
      if (target.type === '24h') {
        updateData.reminder24hSentAt = nowUtc;
      } else if (target.type === '2h') {
        updateData.reminder2hSentAt = nowUtc;
      }

      await adminDb.collection('appointments').doc(appt.id).update(updateData);
      appointmentsReminded++;
    }
  }

  return {
    ok: true,
    timestamp: nowUtc,
    summary: {
      householdsProcessed,
      upcomingDosesReminded,
      dosesMarkedMissed,
      dosesEscalated,
      appointmentsReminded,
    },
  };
}

export async function GET(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret header', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const result = await processCronReminders();
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[GET /api/cron/reminders] Cron execution failed:', error);
    return NextResponse.json(
      { error: 'Cron reminder process failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid cron secret header', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const result = await processCronReminders();
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[POST /api/cron/reminders] Cron execution failed:', error);
    return NextResponse.json(
      { error: 'Cron reminder process failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
