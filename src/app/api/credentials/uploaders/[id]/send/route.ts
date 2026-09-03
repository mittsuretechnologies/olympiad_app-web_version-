import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendUploaderCredentialsEmail } from '@/lib/mailer';
import { requireRole } from '@/lib/auth-guard';

// POST /api/credentials/uploaders/:id/send — emails the uploader's current
// username + password. Uploader.plainPassword is only set after a reset (see
// [id]/reset), so this requires a password to already be on file.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;

    const uploader = await prisma.uploader.findUnique({
      where: { id },
      select: { uploaderId: true, name: true, username: true, plainPassword: true, email: true },
    });
    if (!uploader) {
      return NextResponse.json({ message: 'Uploader not found' }, { status: 404 });
    }
    if (!uploader.plainPassword) {
      return NextResponse.json({ message: 'Reset the password before sending credentials' }, { status: 400 });
    }
    if (!uploader.email) {
      return NextResponse.json({ message: 'No email on file for this uploader' }, { status: 400 });
    }

    try {
      await sendUploaderCredentialsEmail({
        to: uploader.email,
        uploaderName: uploader.name,
        uploaderId: uploader.uploaderId,
        username: uploader.username,
        password: uploader.plainPassword,
      });
    } catch (mailErr: any) {
      console.error(`Credentials email to ${uploader.email} failed:`, mailErr);
      return NextResponse.json({ message: mailErr?.message || 'Failed to send email' }, { status: 502 });
    }

    return NextResponse.json({ success: true, sentTo: uploader.email });
  } catch (error) {
    console.error('POST credentials/uploaders/[id]/send failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
