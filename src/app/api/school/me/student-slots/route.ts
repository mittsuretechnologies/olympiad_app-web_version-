import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '@/lib/jwt-secret';
import { resolveSchoolStudent, slotsForStudent, computeOlympiadSlots } from '@/lib/olympiadSlots';

// GET /api/school/me/student-slots?studentId=<Student.id or AppUser.id>
// Which Olympiad categories this student has already used. Same rule (and the
// same code) as the student's own app, so the school, the web and the student
// always agree. Used by the web upload page and the mobile app.
export async function GET(request: Request) {
  try {
    const auth = request.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    let payload: any;
    try { payload = jwt.verify(token, getJwtSecret()); }
    catch { return NextResponse.json({ message: 'Invalid token' }, { status: 401 }); }
    if (payload?.role !== 'SCHOOL') return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    if (!studentId) return NextResponse.json({ message: 'studentId required' }, { status: 400 });

    const student = await resolveSchoolStudent(payload.id, studentId);
    // Not this school's student (or an assigned-only ID with no account yet).
    if (!student) {
      return NextResponse.json({ message: 'Student not found for this school' }, { status: 404 });
    }
    if (!student.studentRowId && !student.appUserId) {
      return NextResponse.json({
        ...computeOlympiadSlots([]),
        name: student.name, olympiadCode: student.olympiadCode,
        classCode: student.classCode, className: student.className,
      });
    }

    const slots = await slotsForStudent(student);
    return NextResponse.json({
      ...slots,
      name: student.name,
      olympiadCode: student.olympiadCode,
      classCode: student.classCode,
      className: student.className,
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
