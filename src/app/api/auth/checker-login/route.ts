/**
 * Unified login endpoint consumed by all three Olympiad Checker frontends.
 *
 * A single credential set is tried against every role in priority order:
 *   1. SuperAdmin  (email + password)  → role SUPERADMIN  → redirect: master-admin
 *   2. Uploader    (username + password) → role UPLOADER  → redirect: uploader-ui
 *   3. School      (username + password) → role SCHOOL    → redirect: reviewer-ui
 *
 * The issued JWT uses the same secret + algorithm as the rest of the system
 * (mittsure_olympiad_secret_key_2026 / HS256) so the FastAPI checker backend
 * can verify it without any extra config.
 *
 * Response shape (200):
 *   { token, role, redirect, user: { id, name, identifier } }
 */

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'mittsure_olympiad_secret_key_2026';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier: string = (body.identifier ?? body.username ?? body.email ?? '').trim();
    const password: string = body.password ?? '';

    if (!identifier || !password) {
      return NextResponse.json(
        { message: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    // ── 1. Try SuperAdmin (email login) ─────────────────────────────────────
    if (identifier.includes('@')) {
      const admin = await prisma.superAdmin.findUnique({ where: { email: identifier } });
      if (admin && await bcrypt.compare(password, admin.password)) {
        const token = jwt.sign(
          { id: admin.id, email: admin.email, role: 'SUPERADMIN' },
          JWT_SECRET,
          { expiresIn: '1d' }
        );
        return NextResponse.json({
          token,
          role: 'SUPERADMIN',
          redirect: 'master-admin',
          user: { id: admin.id, name: admin.name, identifier: admin.email },
        });
      }
    }

    // ── 2. Try Uploader (username login) ────────────────────────────────────
    const uploader = await prisma.uploader.findUnique({ where: { username: identifier } });
    if (uploader && uploader.status === 'ACTIVE' && await bcrypt.compare(password, uploader.password)) {
      const token = jwt.sign(
        { id: uploader.id, uploaderId: uploader.uploaderId, role: 'UPLOADER' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return NextResponse.json({
        token,
        role: 'UPLOADER',
        redirect: 'uploader-ui',
        user: { id: uploader.id, name: uploader.name, identifier: uploader.username },
      });
    }

    // ── 3. Try School (username login) ──────────────────────────────────────
    const school = await prisma.school.findUnique({ where: { username: identifier } });
    if (school && school.password && await bcrypt.compare(password, school.password)) {
      const token = jwt.sign(
        { id: school.id, schoolId: school.schoolId, role: 'SCHOOL' },
        JWT_SECRET,
        { expiresIn: '1d' }
      );
      return NextResponse.json({
        token,
        role: 'SCHOOL',
        redirect: 'reviewer-ui',
        user: { id: school.id, name: school.name, identifier: school.username },
      });
    }

    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Checker login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
