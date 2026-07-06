import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getReportThreshold, setReportThreshold } from '@/lib/reportSettings';

function requireSuperAdmin(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
    return payload?.role === 'SUPERADMIN' ? payload : null;
  } catch {
    return null;
  }
}

// GET — current report threshold (SuperAdmin only)
export async function GET(request: Request) {
  const admin = requireSuperAdmin(request);
  if (!admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const threshold = await getReportThreshold();
  return NextResponse.json({ threshold });
}

// POST — update the report threshold (SuperAdmin only)
export async function POST(request: Request) {
  const admin = requireSuperAdmin(request);
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
