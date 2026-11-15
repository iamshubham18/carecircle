import { adminDb } from './firebase';
import type { AuditEntry } from './types';

export interface WriteAuditParams {
  householdId: string;
  actorId: string;
  action: 'create' | 'update' | 'delete' | 'take_dose';
  entity: 'medication' | 'appointment' | 'dose' | 'permission';
  entityId: string;
  summary: string;
}

/**
 * Writes an immutable audit entry to Firestore
 */
export async function writeAudit(params: WriteAuditParams): Promise<AuditEntry> {
  const docRef = adminDb.collection('auditLog').doc();
  const entry: AuditEntry = {
    id: docRef.id,
    householdId: params.householdId,
    actorId: params.actorId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    summary: params.summary,
    at: new Date().toISOString(),
  };

  try {
    await docRef.set(entry);
  } catch (_e) {
    // Prevent audit logging failures from crashing API operations
  }

  return entry;
}
