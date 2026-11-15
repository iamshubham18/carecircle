import type { Medication, DoseLog, Appointment } from './types';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Timing helpers that read optional environment variables with standard defaults
 */
export function getGraceMinutes(): number {
  const val = parseInt(process.env.GRACE_MINUTES || '30', 10);
  return isNaN(val) ? 30 : val;
}

export function getEscalationMinutes(): number {
  const val = parseInt(process.env.ESCALATION_MINUTES || '30', 10);
  return isNaN(val) ? 30 : val;
}

export function getLookaheadMinutes(): number {
  const val = parseInt(process.env.LOOKAHEAD_MINUTES || '15', 10);
  return isNaN(val) ? 15 : val;
}

export const DEFAULT_GRACE_MINUTES = 30;
export const DEFAULT_ESCALATION_MINUTES = 30;
export const DEFAULT_LOOKAHEAD_MINUTES = 15;

/**
 * Calculates timezone offset in minutes for a specific point in time using standard Intl API
 */
export function getTimezoneOffsetMinutes(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const findPart = (type: string) => {
      const p = parts.find((item) => item.type === type);
      return p ? parseInt(p.value, 10) : 0;
    };
    const year = findPart('year');
    const month = findPart('month') - 1;
    const day = findPart('day');
    let hour = findPart('hour');
    if (hour === 24) hour = 0;
    const minute = findPart('minute');
    const second = findPart('second');

    const tzDateAsUtc = Date.UTC(year, month, day, hour, minute, second);
    return Math.round((tzDateAsUtc - date.getTime()) / 60000);
  } catch (_e) {
    // Fallback to +05:30 (330 min) for Asia/Kolkata
    return 330;
  }
}

/**
 * Pure function: Converts a local date string (YYYY-MM-DD) and local time (HH:mm)
 * in the specified timezone into a UTC ISO string.
 */
export function localTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const [hourStr, minuteStr] = timeStr.split(':');

  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '1', 10) - 1;
  const day = parseInt(dayStr || '1', 10);
  const hour = parseInt(hourStr || '0', 10);
  const minute = parseInt(minuteStr || '0', 10);

  const approxUtc = new Date(Date.UTC(year, month, day, hour, minute, 0));
  const offsetMinutes = getTimezoneOffsetMinutes(approxUtc, timeZone);

  const exactUtcMs = approxUtc.getTime() - offsetMinutes * 60000;
  return new Date(exactUtcMs).toISOString();
}

/**
 * Pure function: Formats a UTC ISO string into HH:mm in the household's timezone for display
 */
export function formatUtcToLocalTime(
  utcIso: string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const date = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Pure function: Formats a UTC ISO datetime into human-friendly local string (e.g. 15 Nov, 10:30 AM)
 */
export function formatUtcToLocalDateTime(
  utcIso: string,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const date = new Date(utcIso);
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return formatter.format(date);
}

/**
 * Pure function: Gets YYYY-MM-DD date string in household timezone
 */
export function getLocalDateString(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Pure function: Add days to YYYY-MM-DD date string
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y || 2026, (m || 1) - 1, (d || 1) + days));
  return date.toISOString().split('T')[0] || dateStr;
}

/**
 * Pure function: Generate dose slots for a medication over a date range.
 * Stores scheduledAt in UTC, converting from household timezone HH:mm times.
 */
export function generateDoses(
  medication: Medication,
  startDate: string,
  days: number = 7,
  timezone: string = DEFAULT_TIMEZONE
): DoseLog[] {
  if (!medication.active) {
    return [];
  }

  const doses: DoseLog[] = [];
  const times = [...(medication.times || [])].sort();

  for (let i = 0; i < days; i++) {
    const currentDate = addDays(startDate, i);

    if (currentDate < medication.startDate) {
      continue;
    }

    if (medication.endDate && currentDate > medication.endDate) {
      continue;
    }

    for (const time of times) {
      const scheduledAtUtc = localTimeToUtc(currentDate, time, timezone);
      const cleanTime = time.replace(':', '');
      const doseId = `${medication.id}_${currentDate}_${cleanTime}`;

      doses.push({
        id: doseId,
        householdId: medication.householdId,
        medicationId: medication.id,
        scheduledAt: scheduledAtUtc,
        status: 'pending',
      });
    }
  }

  return doses;
}

/**
 * Pure function: Detects missed doses where status is 'pending' and the scheduled
 * time has passed the grace window (default 30 min or GRACE_MINUTES env var).
 */
export function detectMissedDoses(
  doses: DoseLog[],
  nowUtc: string = new Date().toISOString(),
  graceMinutes: number = getGraceMinutes()
): DoseLog[] {
  const nowMs = new Date(nowUtc).getTime();
  const graceMs = graceMinutes * 60 * 1000;

  return doses
    .filter((dose) => {
      if (dose.status !== 'pending') return false;
      const scheduledMs = new Date(dose.scheduledAt).getTime();
      return scheduledMs + graceMs < nowMs;
    })
    .map((dose) => ({
      ...dose,
      status: 'missed' as const,
    }));
}

/**
 * Pure function: Checks if a missed dose is ready for caretaker escalation
 */
export function shouldEscalate(
  dose: DoseLog,
  nowUtc: string = new Date().toISOString(),
  delayMinutes: number = getEscalationMinutes(),
  graceMinutes: number = getGraceMinutes()
): boolean {
  if (dose.status !== 'missed' || dose.escalatedAt) {
    return false;
  }
  const nowMs = new Date(nowUtc).getTime();
  const scheduledMs = new Date(dose.scheduledAt).getTime();
  const escalationThresholdMs = scheduledMs + (graceMinutes + delayMinutes) * 60 * 1000;
  return nowMs >= escalationThresholdMs;
}

/**
 * Pure function: Finds doses due in the next windowMinutes (default 15 mins or LOOKAHEAD_MINUTES env var)
 * that have not yet had a reminder sent.
 * Idempotent: Excludes any dose where reminderSentAt is already set.
 */
export function findUpcomingDoses(
  doses: DoseLog[],
  nowUtc: string = new Date().toISOString(),
  windowMinutes: number = getLookaheadMinutes()
): DoseLog[] {
  const nowMs = new Date(nowUtc).getTime();
  const windowMs = windowMinutes * 60 * 1000;

  return doses.filter((dose) => {
    if (dose.status !== 'pending') return false;
    if (dose.reminderSentAt) return false;

    const scheduledMs = new Date(dose.scheduledAt).getTime();
    return scheduledMs >= nowMs - 60000 && scheduledMs <= nowMs + windowMs;
  });
}

/**
 * Pure function: Finds pending doses that have passed the grace window (default 30 mins or GRACE_MINUTES).
 */
export function findOverdueDosesToMarkMissed(
  doses: DoseLog[],
  nowUtc: string = new Date().toISOString(),
  graceMinutes: number = getGraceMinutes()
): DoseLog[] {
  const nowMs = new Date(nowUtc).getTime();
  const graceMs = graceMinutes * 60 * 1000;

  return doses.filter((dose) => {
    if (dose.status !== 'pending') return false;
    const scheduledMs = new Date(dose.scheduledAt).getTime();
    return scheduledMs + graceMs < nowMs;
  });
}

/**
 * Pure function: Finds missed doses without escalatedAt where an additional
 * delayMinutes (default 30 mins or ESCALATION_MINUTES) have passed since the grace window.
 */
export function findMissedDosesToEscalate(
  doses: DoseLog[],
  nowUtc: string = new Date().toISOString(),
  delayMinutes: number = getEscalationMinutes(),
  graceMinutes: number = getGraceMinutes()
): DoseLog[] {
  const nowMs = new Date(nowUtc).getTime();
  const totalThresholdMs = (graceMinutes + delayMinutes) * 60 * 1000;

  return doses.filter((dose) => {
    if (dose.status !== 'missed') return false;
    if (dose.escalatedAt) return false;

    const scheduledMs = new Date(dose.scheduledAt).getTime();
    return nowMs >= scheduledMs + totalThresholdMs;
  });
}

export interface AppointmentReminderTarget {
  appointment: Appointment;
  type: '24h' | '2h';
  noticeLabel: '24 hours' | '2 hours';
}

/**
 * Pure function: Finds appointments requiring 24h or 2h reminders.
 * Idempotent: Never sends the same reminder twice.
 */
export function findAppointmentsNeedingReminder(
  appointments: Appointment[],
  nowUtc: string = new Date().toISOString()
): AppointmentReminderTarget[] {
  const nowMs = new Date(nowUtc).getTime();
  const targets: AppointmentReminderTarget[] = [];

  for (const appt of appointments) {
    const apptMs = new Date(appt.datetime).getTime();
    const diffHours = (apptMs - nowMs) / (1000 * 60 * 60);

    // 24h window: between 23h and 25h ahead, without reminder24hSentAt
    if (diffHours >= 23 && diffHours <= 25 && !appt.reminder24hSentAt) {
      targets.push({
        appointment: appt,
        type: '24h',
        noticeLabel: '24 hours',
      });
    }

    // 2h window: between 1h and 2.5h ahead, without reminder2hSentAt
    if (diffHours >= 1 && diffHours <= 2.5 && !appt.reminder2hSentAt) {
      targets.push({
        appointment: appt,
        type: '2h',
        noticeLabel: '2 hours',
      });
    }
  }

  return targets;
}
