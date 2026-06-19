import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

/**
 * Unified login for the Olympiad CHECKER portal (apps/portal, the AI-grading
 * workspace). The portal has a single login box that sends { identifier, password }
 * and does not know the caller's role up front, so this endpoint tries each role
 * the checker supports in turn and returns a JWT the FastAPI checker backend can
 * verify.
 *
 * Roles handled (only the three the checker portal uses):
 *   1. SuperAdmin (email + password)        → role SUPERADMIN → checker: master_admin
 *   2. Uploader   (username + password)     → role UPLOADER   → checker: uploader
 *   3. Reviewer   (reviewerId + password)   → role REVIEWER   → checker: reviewer
 *
 * NOTE: School/Viewer/Evaluator are intentionally NOT handled here — they are not
 * checker-portal roles. The web app's own /api/auth/login covers those flows.
 *
 * The JWT is signed with JWT_SECRET (HS256), the same secret the FastAPI checker
 * verifies with (its JWT_SECRET_KEY). Payload uses `id` + `role`, which the
 * checker's jwt.py reads and maps via _ROLE_MAP. Keep this contract in sync with
 * services/api/app/auth/jwt.py in the olympiad-checker repo.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier: string = (body.identifier ?? body.email ?? body.username ?? '').trim();
    const password: string = body.password ?? '';

    if (!identifier || !password) {
      return NextResponse.json(
        { message: 'Username/email and password are required' },
        { status: 400 }
      );
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

    // ── 1. SuperAdmin (by email) ────────────────────────────────────────────
    if (identifier.includes('@')) {
      const admin = await prisma.superAdmin.findUnique({ where: { email: identifier } });
      if (admin) {
        const ok = await bcrypt.compare(password, admin.password);
        if (!ok) {
          return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
        }
        const token = jwt.sign(
          { id: admin.id, email: admin.email, role: 'SUPERADMIN' },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        return NextResponse.json({
          message: 'Login successful',
          token,
          role: 'SUPERADMIN',
          redirect: 'master-admin',
          user: { id: admin.id, email: admin.email, name: admin.name },
        });
      }
    }

    // ── 2. Uploader (by username) ───────────────────────────────────────────
    const uploader = await prisma.uploader.findUnique({ where: { username: identifier } });
    if (uploader) {
      if (uploader.status !== 'ACTIVE') {
        return NextResponse.json(
          { message: 'Your account has been deactivated. Contact admin.' },
          { status: 403 }
        );
      }
      const ok = await bcrypt.compare(password, uploader.password);
      if (!ok) {
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      }
      const token = jwt.sign(
        { id: uploader.id, uploaderId: uploader.uploaderId, role: 'UPLOADER' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        role: 'UPLOADER',
        redirect: 'uploader-ui',
        user: { id: uploader.id, uploaderId: uploader.uploaderId, name: uploader.name },
      });
    }

    // ── 3. Reviewer (by reviewerId) ─────────────────────────────────────────
    const reviewer = await prisma.reviewer.findUnique({
      where: { reviewerId: identifier.toUpperCase() },
    });
    if (reviewer) {
      const ok = await bcrypt.compare(password, reviewer.password);
      if (!ok) {
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      }
      if (!reviewer.isActive) {
        return NextResponse.json(
          { message: 'Your account has been deactivated. Contact admin.' },
          { status: 403 }
        );
      }
      const token = jwt.sign(
        { id: reviewer.id, reviewerId: reviewer.reviewerId, role: 'REVIEWER' },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        role: 'REVIEWER',
        redirect: 'reviewer-ui',
        user: { id: reviewer.id, reviewerId: reviewer.reviewerId, name: reviewer.name, email: reviewer.email },
      });
    }

    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Checker login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
