import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function getStudentFromToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'student' && decoded.role !== 'STUDENT') return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const student = getStudentFromToken(request);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Fetch the video first — verify it belongs to this student
    const video = await prisma.video.findUnique({ where: { id } });

    if (!video || video.deletedAt) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.studentId !== student.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete — record and file are retained for SuperAdmin/backend visibility
    // (including any Olympiad approval it represents); only hidden from normal views.
    await prisma.video.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('Delete video error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
