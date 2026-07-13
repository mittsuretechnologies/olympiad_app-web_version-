import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

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

    // 1) Try SuperAdmin (by email)
    if (identifier.includes('@')) {
      const admin = await prisma.superAdmin.findUnique({
        where: { email: identifier },
      });
      if (admin) {
        const ok = await bcrypt.compare(password, admin.password);
        if (!ok) {
          return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
        }
        const token = jwt.sign(
          { id: admin.id, email: admin.email, role: 'SUPERADMIN' },
          process.env.JWT_SECRET || 'fallback_secret',
          { expiresIn: '1d' }
        );
        return NextResponse.json({
          message: 'Login successful',
          token,
          role: 'SUPERADMIN',
          redirect: '/dashboard',
          user: { id: admin.id, email: admin.email, name: admin.name },
        });
      }
    }

    // 2) Try School (by username = schoolId)
    const school = await prisma.school.findUnique({
      where: { username: identifier },
    });
    if (school && school.password) {
      const ok = await bcrypt.compare(password, school.password);
      if (!ok) {
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      }
      const token = jwt.sign(
        { id: school.id, schoolId: school.schoolId, role: 'SCHOOL' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '1d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        role: 'SCHOOL',
        redirect: '/school',
        user: {
          id: school.id,
          schoolId: school.schoolId,
          name: school.name,
          contactPerson: school.contactPerson,
        },
      });
    }

    // 3) Try Reviewer (by reviewerId)
    const reviewer = await prisma.reviewer.findUnique({
      where: { reviewerId: identifier.toUpperCase() },
    });
    if (reviewer) {
      const ok = await bcrypt.compare(password, reviewer.password);
      if (!ok) return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      if (!reviewer.isActive) return NextResponse.json({ message: 'Your account has been deactivated. Contact admin.' }, { status: 403 });
      const token = jwt.sign(
        { id: reviewer.id, reviewerId: reviewer.reviewerId, role: 'REVIEWER' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '7d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        role: 'REVIEWER',
        redirect: '/dashboard',
        user: { id: reviewer.id, reviewerId: reviewer.reviewerId, name: reviewer.name, email: reviewer.email },
      });
    }

    // 4) Try Evaluator (by evaluatorId)
    const evaluator = await prisma.talentEvaluator.findUnique({
      where: { evaluatorId: identifier.toUpperCase() },
    });
    if (evaluator) {
      const ok = await bcrypt.compare(password, evaluator.password);
      if (!ok) return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      if (!evaluator.isActive) return NextResponse.json({ message: 'Your account has been deactivated. Contact admin.' }, { status: 403 });
      const token = jwt.sign(
        { id: evaluator.id, evaluatorId: evaluator.evaluatorId, role: 'EVALUATOR' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '7d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        role: 'EVALUATOR',
        redirect: '/dashboard',
        user: { id: evaluator.id, evaluatorId: evaluator.evaluatorId, name: evaluator.name, email: evaluator.email },
      });
    }

    // 5) Try Moderator (by moderatorId)
    const moderator = await prisma.moderator.findUnique({
      where: { moderatorId: identifier.toUpperCase() },
    });
    if (moderator) {
      const ok = await bcrypt.compare(password, moderator.password);
      if (!ok) return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
      if (!moderator.isActive) return NextResponse.json({ message: 'Your account has been deactivated. Contact admin.' }, { status: 403 });
      const token = jwt.sign(
        { id: moderator.id, moderatorId: moderator.moderatorId, role: 'MODERATOR' },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '7d' }
      );
      return NextResponse.json({
        message: 'Login successful',
        token,
        role: 'MODERATOR',
        redirect: '/dashboard',
        user: { id: moderator.id, moderatorId: moderator.moderatorId, name: moderator.name, email: moderator.email },
      });
    }

    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
