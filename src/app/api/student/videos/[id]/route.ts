import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verify } from 'jsonwebtoken';
import { unlink } from 'fs/promises';
import path from 'path';

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
  { params }: { params: { id: string } }
) {
  const student = getStudentFromToken(request);
  if (!student) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    // Fetch the video first — verify it belongs to this student
    const video = await prisma.video.findUnique({ where: { id } });

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    if (video.studentId !== student.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the DB record first
    await prisma.video.delete({ where: { id } });

    // Then try to delete the physical file from /public/uploads — best-effort,
    // don't fail the request if the file is already gone or was hosted elsewhere
    try {
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      if (video.videoUrl.startsWith(serverUrl)) {
        const relativePath = video.videoUrl.replace(serverUrl, '');
        const filePath = path.join(process.cwd(), 'public', relativePath);
        await unlink(filePath);
      }
    } catch {
      // File missing or external URL — silently ignore
    }

    return NextResponse.json({ message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('Delete video error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
