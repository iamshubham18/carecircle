import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminDb();
    // Confirms Firestore connectivity
    await db.listCollections();

    return NextResponse.json(
      {
        ok: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (_error: unknown) {
    // Confirm connectivity without leaking internal error details or credentials
    return NextResponse.json(
      {
        ok: false,
        status: 'database_unavailable',
      },
      { status: 503 }
    );
  }
}
