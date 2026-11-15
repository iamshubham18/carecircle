import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { adminDb } from '@/lib/firebase';
import { can, DEFAULT_PERMISSIONS_MATRIX } from '@/lib/permissions';
import { checkRateLimit } from '@/lib/rateLimit';
import { scanPrescriptionImage } from '@/lib/gemini';
import type { PermissionsMatrix } from '@/lib/types';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB cap
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  try {
    // 1. Session check
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    // 2. Permission check: user must have editMeds permission
    const permSnap = await adminDb.collection('permissions').doc(session.householdId).get();
    const permissions: PermissionsMatrix = permSnap.exists
      ? (permSnap.data() as PermissionsMatrix)
      : DEFAULT_PERMISSIONS_MATRIX;

    if (!can(session.role, 'editMeds', permissions)) {
      return NextResponse.json(
        { error: 'You do not have permission to add or scan medications', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // 3. In-memory Rate limit: 5 requests per minute per user
    const rateCheck = checkRateLimit(`ai:scan:${session.userId}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a minute before scanning again.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // 4. Accept either multipart/form-data or application/json base64
    let base64Data = '';
    let mimeType = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('image') || formData.get('file');

      if (!file || typeof file === 'string' || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: 'No image file provided in request', code: 'INVALID_IMAGE' },
          { status: 400 }
        );
      }

      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: 'Image exceeds maximum size of 4 MB', code: 'FILE_TOO_LARGE' },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: 'Only JPEG, PNG, and WebP images are supported', code: 'UNSUPPORTED_MEDIA' },
          { status: 400 }
        );
      }

      mimeType = file.type;
      const buffer = Buffer.from(await file.arrayBuffer());
      base64Data = buffer.toString('base64');
    } else if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.imageBase64 !== 'string' || typeof body.mimeType !== 'string') {
        return NextResponse.json(
          { error: 'Invalid payload: imageBase64 and mimeType are required', code: 'INVALID_IMAGE' },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.has(body.mimeType)) {
        return NextResponse.json(
          { error: 'Only JPEG, PNG, and WebP images are supported', code: 'UNSUPPORTED_MEDIA' },
          { status: 400 }
        );
      }

      // Check base64 length (~4/3 of byte size)
      const approxBytes = (body.imageBase64.length * 3) / 4;
      if (approxBytes > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: 'Image exceeds maximum size of 4 MB', code: 'FILE_TOO_LARGE' },
          { status: 400 }
        );
      }

      mimeType = body.mimeType;
      // Strip potential data URL prefix
      base64Data = body.imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
    } else {
      return NextResponse.json(
        { error: 'Unsupported request content type', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // 5. Scan image with Gemini
    const draftMedications = await scanPrescriptionImage(base64Data, mimeType);

    // Return the validated draft ONLY (does NOT write to Firestore)
    return NextResponse.json({
      ok: true,
      draft: draftMedications,
    });
  } catch (error: unknown) {
    // Log complete error details on server
    console.error('[POST /api/ai/scan] Error during prescription scan:', error);

    // Never leak raw internal stack or details to client
    return NextResponse.json(
      {
        error: 'Unable to analyze the prescription photo. Please try again with a clearer photo or enter details manually.',
        code: 'AI_SCAN_FAILED',
      },
      { status: 500 }
    );
  }
}
