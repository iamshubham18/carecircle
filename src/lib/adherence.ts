import type { DoseLog } from './types';

/**
 * Pure function: Calculate adherence percentage based on dose logs
 * Only doses scheduled up to now (taken or missed) count toward adherence
 */
export function calculateAdherence(doses: DoseLog[]): number {
  if (doses.length === 0) {
    return 100; // No scheduled doses default
  }

  // Count taken vs completed (taken + missed) or all scheduled
  const completed = doses.filter((d) => d.status === 'taken' || d.status === 'missed');
  if (completed.length === 0) {
    return 100;
  }

  const taken = completed.filter((d) => d.status === 'taken').length;
  return Math.round((taken / completed.length) * 100);
}
