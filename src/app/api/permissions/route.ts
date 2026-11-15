import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { updatePermissionsSchema } from '@/lib/validators';
import { writeAudit } from '@/lib/audit';
import type { PermissionsMatrix, RolePermissions } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Elder can never be locked out — always full access. */
const ELDER_FULL_PERMISSIONS: RolePermissions = {
  canViewMeds: true,
  canEditMeds: true,
  canViewAppointments: true,
  canEditAppointments: true,
  canViewAdherence: true,
  requireElderApproval: false,
};

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

    return NextResponse.json({ ok: true, permissions });
  } catch (error: unknown) {
    console.error('[GET /api/permissions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // Only elder can update permissions
    if (session.role !== 'elder') {
      return NextResponse.json(
        { error: 'Only the elder can change household permissions', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parseResult = updatePermissionsSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.errors[0]?.message || 'Invalid permissions data',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { caretaker, family } = parseResult.data;

    // Build the final matrix — elder is always full access regardless of input
    const newPermissions: PermissionsMatrix = {
      elder: ELDER_FULL_PERMISSIONS,
      caretaker: {
        canViewMeds: caretaker.canViewMeds,
        canEditMeds: caretaker.canEditMeds,
        canViewAppointments: caretaker.canViewAppointments,
        canEditAppointments: caretaker.canEditAppointments,
        canViewAdherence: caretaker.canViewAdherence,
        requireElderApproval: caretaker.requireElderApproval ?? false,
      },
      family: {
        canViewMeds: family.canViewMeds,
        canEditMeds: family.canEditMeds,
        canViewAppointments: family.canViewAppointments,
        canEditAppointments: family.canEditAppointments,
        canViewAdherence: family.canViewAdherence,
        requireElderApproval: family.requireElderApproval ?? false,
      },
    };

    await adminDb.collection('permissions').doc(session.householdId).set(newPermissions);

    await writeAudit({
      householdId: session.householdId,
      actorId: session.userId,
      action: 'update_permissions',
      entity: 'permission',
      entityId: session.householdId,
      summary: `${session.name} (elder) updated household permission settings`,
    });

    return NextResponse.json({ ok: true, permissions: newPermissions });
  } catch (error: unknown) {
    console.error('[PUT /api/permissions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update permissions', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
