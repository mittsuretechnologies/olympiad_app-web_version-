import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-guard';
import { encryptPassword, decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog, recordAuditLog } from '@/lib/audit-log';
import { generateMasterAdminPassword } from '@/lib/masterAdminPassword';
import { isValidMasterAdminHandle, masterAdminUsername, normalizeMasterAdminHandle, MASTER_ADMIN_TABLE_MISSING_MESSAGE } from '@/lib/masterAdmin';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

const LIST_SELECT = {
  id: true, username: true, name: true, email: true, mobile: true, jobTitle: true,
  avatar: true, isActive: true, plainPassword: true, createdAt: true,
} as const;

// GET /api/master-admins — every Master Admin, newest first. SuperAdmin only.
export async function GET(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const rows = await prisma.masterAdmin.findMany({ orderBy: { createdAt: 'desc' }, select: LIST_SELECT });
    await recordAccessLog(payload, {
      action: 'CREDENTIALS_VIEWED', entityType: 'MasterAdmin', subjectIds: rows.map((r) => r.id), request,
    });
    return NextResponse.json(rows.map((r) => ({ ...r, plainPassword: decryptPassword(r.plainPassword) })));
  } catch (e: any) {
    if (e.code === 'P2021') return NextResponse.json({ message: MASTER_ADMIN_TABLE_MISSING_MESSAGE }, { status: 503 });
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}

// POST /api/master-admins — body: { name, username, mobile?, email?, jobTitle?, avatar? }
// The password is always generated here and returned once in the response.
export async function POST(request: Request) {
  const { error, payload } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const handle = normalizeMasterAdminHandle(String(body.username ?? ''));
    const email = String(body.email ?? '').trim().toLowerCase();
    const mobile = String(body.mobile ?? '').replace(/\D/g, '');
    const jobTitle = String(body.jobTitle ?? '').trim();
    const avatar = String(body.avatar ?? '').trim() || 'male';

    if (!name) return NextResponse.json({ message: 'Full name is required' }, { status: 400 });
    if (!isValidMasterAdminHandle(handle)) {
      return NextResponse.json({
        message: 'Username must be 3–40 characters: lowercase letters and numbers, optionally joined by "." or "_" (e.g. rohan.sharma)',
      }, { status: 400 });
    }
    if (email && !EMAIL_RE.test(email)) return NextResponse.json({ message: 'Enter a valid email address' }, { status: 400 });
    if (mobile && !MOBILE_RE.test(mobile)) return NextResponse.json({ message: 'Enter a valid 10-digit mobile number' }, { status: 400 });

    const username = masterAdminUsername(handle);
    const password = generateMasterAdminPassword();
    const created = await prisma.masterAdmin.create({
      data: {
        username, name,
        email: email || null,
        mobile: mobile || null,
        jobTitle: jobTitle || null,
        avatar,
        password: await bcrypt.hash(password, 10),
        plainPassword: encryptPassword(password),
        createdBy: payload.id,
      },
      select: LIST_SELECT,
    });

    await recordAuditLog({
      actorId: payload.id, actorRole: payload.role, actorName: payload.name || payload.email,
      action: 'MASTER_ADMIN_CREATED', entityType: 'MasterAdmin', entityId: created.id,
      newValue: { username, name, email: created.email, mobile: created.mobile, jobTitle: created.jobTitle },
    });

    return NextResponse.json({ ...created, plainPassword: password }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2021') return NextResponse.json({ message: MASTER_ADMIN_TABLE_MISSING_MESSAGE }, { status: 503 });
    if (e.code === 'P2002') {
      const field = Array.isArray(e.meta?.target) ? e.meta.target.join(',') : String(e.meta?.target ?? '');
      return NextResponse.json({
        message: field.includes('email') ? 'This email is already used by another Master Admin' : 'This username is already taken',
      }, { status: 409 });
    }
    return NextResponse.json({ message: e.message }, { status: 500 });
  }
}
