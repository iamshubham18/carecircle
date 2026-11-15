import type { DoseLog } from './types';

export interface AdherenceSummary {
  today: number;
  sevenDay: number;
  thirtyDay: number;
  totalTaken: number;
  totalMissed: number;
  totalPending: number;
}

/**
 * Pure function: Calculate adherence percentage based on an array of doses.
 * Considers doses that are either 'taken' or 'missed'.
 * Returns 100 when there are no completed doses (empty state handling).
 */
export function calculateAdherence(doses: DoseLog[]): number {
  if (!doses || doses.length === 0) {
    return 100;
  }

  const completed = doses.filter((d) => d.status === 'taken' || d.status === 'missed');
  if (completed.length === 0) {
    return 100;
  }

  const taken = completed.filter((d) => d.status === 'taken').length;
  return Math.round((taken / completed.length) * 100);
}

/**
 * Pure function: Filters doses falling within the past N days from nowUtc
 */
export function filterDosesPastDays(
  doses: DoseLog[],
  days: number,
  nowUtc: string = new Date().toISOString()
): DoseLog[] {
  const nowMs = new Date(nowUtc).getTime();
  const pastMs = nowMs - days * 24 * 60 * 60 * 1000;

  return doses.filter((d) => {
    const scheduledMs = new Date(d.scheduledAt).getTime();
    return scheduledMs >= pastMs && scheduledMs <= nowMs;
  });
}

/**
 * Pure function: Computes today, 7-day, and 30-day adherence percentages along with counts
 */
export function calculateAdherenceSummary(
  doses: DoseLog[],
  nowUtc: string = new Date().toISOString()
): AdherenceSummary {
  const todayDoses = filterDosesPastDays(doses, 1, nowUtc);
  const sevenDayDoses = filterDosesPastDays(doses, 7, nowUtc);
  const thirtyDayDoses = filterDosesPastDays(doses, 30, nowUtc);

  let totalTaken = 0;
  let totalMissed = 0;
  let totalPending = 0;

  for (const dose of doses) {
    if (dose.status === 'taken') totalTaken++;
    else if (dose.status === 'missed') totalMissed++;
    else if (dose.status === 'pending') totalPending++;
  }

  return {
    today: calculateAdherence(todayDoses),
    sevenDay: calculateAdherence(sevenDayDoses),
    thirtyDay: calculateAdherence(thirtyDayDoses),
    totalTaken,
    totalMissed,
    totalPending,
  };
}
