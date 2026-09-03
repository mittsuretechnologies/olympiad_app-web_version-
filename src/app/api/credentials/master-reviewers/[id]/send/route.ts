import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMasterReviewerCredentialsEmail } from '@/lib/mailer';
import { requireRole } from '@/lib/auth-guard';

// POST /api/credentials/master-reviewers/:id/send — emails the master
// reviewer's current masterReviewerId + password.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;

    const masterReviewer = await prisma.masterReviewer.findUnique({
      where: { id },
      select: { masterReviewerId: true, name: true, plainPassword: true, email: true },
    });
    if (!masterReviewer) {
      return NextResponse.json({ message: 'Master reviewer not found' }, { status: 404 });
    }
    if (!masterReviewer.plainPassword) {
      return NextResponse.json({ message: 'Reset the password before sending credentials' }, { status: 400 });
    }

    try {
      await sendMasterReviewerCredentialsEmail({
        to: masterReviewer.email,
        masterReviewerName: masterReviewer.name,
        masterReviewerId: masterReviewer.masterReviewerId,
        password: masterReviewer.plainPassword,
      });
    } catch (mailErr: any) {
      console.error(`Credentials email to ${masterReviewer.email} failed:`, mailErr);
      return NextResponse.json({ message: mailErr?.message || 'Failed to send email' }, { status: 502 });
    }

    return NextResponse.json({ success: true, sentTo: masterReviewer.email });
  } catch (error) {
    console.error('POST credentials/master-reviewers/[id]/send failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
