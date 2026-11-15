import type { AuditEntry } from './types';

/**
 * Placeholder for writing audit log entries to Firestore (Phase 5)
 */
export async function writeAudit(
  _householdId: string,
  _actorId: string,
  _action: string,
  _entity: string,
  _entityId: string,
  _summary: string
): Promise<AuditEntry> {
  const entry: AuditEntry = {
    id: `audit_${Date.now()}`,
    householdId: _householdId,
    actorId: _actorId,
    action: _action,
    entity: _entity,
    entityId: _entityId,
    summary: _summary,
    at: new Date().toISOString(),
  };

  // In Phase 5, this will write to adminDb.collection('auditLog')
  return entry;
}
