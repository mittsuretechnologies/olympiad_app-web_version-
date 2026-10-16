import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { isValidMasterAdminHandle, masterAdminUsername, normalizeMasterAdminHandle, MASTER_ADMIN_TABLE_MISSING_MESSAGE } from '@/lib/masterAdmin';

export const dynamic = 'force-dynamic';

// GET /api/master-admins/username-check?handle=rohan.sharma
// -> { handle, valid, available, suggestion }
// `suggestion` is the first free handle in rohan.sharma, rohan.sharma2,
// rohan.sharma3, … — equal to `handle` when that one is free. Read-only; the
// unique index on MasterAdmin.username is still what guarantees uniqueness at
// create time. SuperAdmin only.
export async function GET(request: Request) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;

  const handle = normalizeMasterAdminHandle(new URL(request.url).searchParams.get('handle') || '');
  if (!isValidMasterAdminHandle(handle)) {
    return NextResponse.json({ handle, valid: false, available: false, suggestion: null });
  }

  try {
    const taken = new Set(
      (await prisma.masterAdmin.findMany({
        // Shorter prefix so trimmed candidates (see below) are covered too.
        where: { username: { startsWith: handle.slice(0, 37).replace(/[._]+$/, '') } },
        select: { username: true },
      })).map((r) => r.username),
    );

    let suggestion: string | null = null;
    for (let n = 1; n < 1000; n++) {
      const suffix = n === 1 ? '' : String(n);
      // Keep within the 40-char limit by trimming the base, not the number.
      const candidate = `${handle.slice(0, 40 - suffix.length).replace(/[._]+$/, '')}${suffix}`;
      if (!taken.has(masterAdminUsername(candidate))) { suggestion = candidate; break; }
    }

    return NextResponse.json({
      handle,
      valid: true,
      available: !taken.has(masterAdminUsername(handle)),
      suggestion,
    });
  } catch (e: any) {
    if (e.code === 'P2021') return NextResponse.json({ message: MASTER_ADMIN_TABLE_MISSING_MESSAGE }, { status: 503 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
