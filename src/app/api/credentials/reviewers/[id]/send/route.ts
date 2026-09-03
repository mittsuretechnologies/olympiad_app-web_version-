import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendReviewerCredentialsEmail } from '@/lib/mailer';
import { requireRole } from '@/lib/auth-guard';

// POST /api/credentials/reviewers/:id/send — emails the reviewer's current
// reviewerId + password.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = requireRole(request, ['SUPERADMIN']);
  if (error) return error;
  try {
    const { id } = await params;

    const reviewer = await prisma.reviewer.findUnique({
      where: { id },
      select: { reviewerId: true, name: true, plainPassword: true, email: true },
    });
    if (!reviewer) {
      return NextResponse.json({ message: 'Reviewer not found' }, { status: 404 });
    }
    if (!reviewer.plainPassword) {
      return NextResponse.json({ message: 'Reset the password before sending credentials' }, { status: 400 });
    }

    try {
      await sendReviewerCredentialsEmail({
        to: reviewer.email,
        reviewerName: reviewer.name,
        reviewerId: reviewer.reviewerId,
        password: reviewer.plainPassword,
      });
    } catch (mailErr: any) {
      console.error(`Credentials email to ${reviewer.email} failed:`, mailErr);
      return NextResponse.json({ message: mailErr?.message || 'Failed to send email' }, { status: 502 });
    }

    return NextResponse.json({ success: true, sentTo: reviewer.email });
  } catch (error) {
    console.error('POST credentials/reviewers/[id]/send failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
