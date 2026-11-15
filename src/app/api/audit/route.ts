import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import type { AuditEntry, EnrichedAuditEntry, Member } from '@/lib/types';

export const dynamic = 'force-dynamic';

const AUDIT_LIMIT = 60;

/** Human-readable label for each audit action */
function describeAction(action: string): string {
  switch (action) {
    case 'create':
      return 'added';
    case 'update':
      return 'updated';
    case 'delete':
      return 'removed';
    case 'take_dose':
      return 'marked a dose as taken for';
    case 'update_permissions':
      return 'changed permissions for';
    case 'scan_confirm':
      return 'confirmed a prescription scan for';
    default:
      return action;
  }
}

/** Human-readable label for each entity type */
function describeEntity(entity: string): string {
  switch (entity) {
    case 'medication':
      return 'medication';
    case 'appointment':
      return 'appointment';
    case 'dose':
      return 'dose record';
    case 'permission':
      return 'household';
    default:
      return entity;
  }
}

/** Entity icons for the activity timeline */
function entityIcon(entity: string): string {
  switch (entity) {
    case 'medication':
      return '💊';
    case 'appointment':
      return '🩺';
    case 'dose':
      return '✅';
    case 'permission':
      return '🔐';
    default:
      return '📋';
  }
}

export type { EnrichedAuditEntry } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limitParam = parseInt(url.searchParams.get('limit') || `${AUDIT_LIMIT}`, 10);
    const limit = isNaN(limitParam) || limitParam < 1 ? AUDIT_LIMIT : Math.min(limitParam, 200);

    // Single-filter query to avoid composite index requirements
    const auditSnap = await adminDb
      .collection('auditLog')
      .where('householdId', '==', session.householdId)
      .get();

    // Fetch members in parallel for actor enrichment (single-filter query)
    const membersSnap = await adminDb
      .collection('members')
      .where('householdId', '==', session.householdId)
      .get();

    const memberMap = new Map<string, Member>();
    for (const doc of membersSnap.docs) {
      const member = doc.data() as Member;
      memberMap.set(member.id, member);
    }

    // Sort descending by `at` and slice in JS to avoid Firestore composite index
    const entries: AuditEntry[] = auditSnap.docs.map((d) => d.data() as AuditEntry);
    entries.sort((a, b) => b.at.localeCompare(a.at));
    const sliced = entries.slice(0, limit);

    const enriched: EnrichedAuditEntry[] = sliced.map((entry) => {
      const actor = memberMap.get(entry.actorId);
      return {
        ...entry,
        actorName: actor?.name ?? 'Unknown user',
        actorRole: actor?.role ?? 'unknown',
        actionLabel: describeAction(entry.action),
        entityLabel: describeEntity(entry.entity),
        icon: entityIcon(entry.entity),
      };
    });

    return NextResponse.json({ ok: true, auditLogs: enriched, total: enriched.length });
  } catch (error: unknown) {
    console.error('[GET /api/audit] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity log', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
