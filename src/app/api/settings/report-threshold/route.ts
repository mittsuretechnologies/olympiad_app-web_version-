import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { getReportThreshold, setReportThreshold } from '@/lib/reportSettings';

// SuperAdmin, or a MasterAdmin granted the Reported Videos module.
async function requireAdminAccess(request: Request) {
  const { payload } = await requireAdmin(request, 'moderation.reported');
  return payload ?? null;
}

// GET — current report threshold (SuperAdmin / granted MasterAdmin)
export async function GET(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const threshold = await getReportThreshold();
  return NextResponse.json({ threshold });
}

// POST — update the report threshold (SuperAdmin / granted MasterAdmin)
export async function POST(request: Request) {
  const admin = await requireAdminAccess(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  try {
    const { threshold } = await request.json();
    if (typeof threshold !== 'number' || threshold < 1) {
      return NextResponse.json({ message: 'threshold must be a positive number' }, { status: 400 });
    }
    const saved = await setReportThreshold(threshold);
    return NextResponse.json({ threshold: saved });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
