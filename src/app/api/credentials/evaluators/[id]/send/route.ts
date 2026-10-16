import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEvaluatorCredentialsEmail } from '@/lib/mailer';
import { requireAdmin } from '@/lib/auth-guard';
import { decryptPassword } from '@/lib/password-crypto';
import { recordAccessLog } from '@/lib/audit-log';

// POST /api/credentials/evaluators/:id/send — emails the evaluator their current
// login credentials over SMTP (see src/lib/mailer.ts). Mirrors the school
// equivalent at /api/credentials/schools/:id/send.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, payload } = await requireAdmin(request, ['credentials.evaluators', 'evaluator.manage']);
  if (error) return error;
  try {
    const { id } = await params;

    const evaluator = await prisma.talentEvaluator.findUnique({
      where: { id },
      select: { evaluatorId: true, name: true, email: true, plainPassword: true },
    });
    if (!evaluator) {
      return NextResponse.json({ message: 'Evaluator not found' }, { status: 404 });
    }
    // Passwords are stored hashed; plainPassword is only kept so admins can
    // re-send credentials. If it's missing the password must be reset first.
    if (!evaluator.plainPassword) {
      return NextResponse.json(
        { message: 'Password not available — reset the password before sending credentials' },
        { status: 400 }
      );
    }

    try {
      await sendEvaluatorCredentialsEmail({
        to: evaluator.email,
        evaluatorName: evaluator.name,
        evaluatorId: evaluator.evaluatorId,
        password: decryptPassword(evaluator.plainPassword)!,
      });
    } catch (mailErr: any) {
      console.error(`Credentials email to ${evaluator.email} failed:`, mailErr);
      return NextResponse.json({ message: mailErr?.message || 'Failed to send email' }, { status: 502 });
    }

    await recordAccessLog(payload, {
      action: 'CREDENTIALS_SENT', entityType: 'TalentEvaluator', subjectIds: [id], request,
      details: { method: 'email', sentTo: evaluator.email },
    });
    return NextResponse.json({ success: true, sentTo: evaluator.email });
  } catch (error) {
    console.error('POST credentials/evaluators/[id]/send failed:', error);
    return NextResponse.json({ message: 'Failed to send credentials' }, { status: 500 });
  }
}
