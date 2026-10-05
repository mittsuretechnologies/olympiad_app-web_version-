import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { detectDocumentExtension } from '@/lib/fileSignature';
import { storeNoticeFile } from '@/lib/infringementFiles';
import { sendInfringementNoticeEmail, sendInfringementAcknowledgementEmail } from '@/lib/mailer';

// Public (unauthenticated) endpoint behind the landing page's Report
// Infringement form. Saves the notice (shown to SuperAdmin under Report
// Infringement), then emails it with its proof documents to the grievance inbox.

export const dynamic = 'force-dynamic';

const AUTHORISED_ROLE = 'A person authorised to act on behalf of the owner or exclusive licensee';
const ROLES = ['The owner of the right', 'An exclusive licensee of the right', AUTHORISED_ROLE];

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES_PER_FIELD = 3;
const MAX_NOTICE_CHARS = 20000;
const CONTENT_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' } as const;

// In-memory limiter: fine for the single pm2 fork process this app runs as.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

const clean = (v: unknown, max: number) =>
  (typeof v === 'string' ? v : '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function readFiles(form: FormData, field: string, label: string) {
  const entries = form.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
  if (entries.length > MAX_FILES_PER_FIELD) throw new Error(`Attach at most ${MAX_FILES_PER_FIELD} files for ${label}.`);

  const files = [];
  for (const [i, file] of entries.entries()) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" is larger than 5 MB.`);
    const content = Buffer.from(await file.arrayBuffer());
    const ext = detectDocumentExtension(content);
    if (!ext) throw new Error(`"${file.name}" must be a PDF, JPG or PNG file.`);
    files.push({ filename: `${field}-${i + 1}.${ext}`, content, contentType: CONTENT_TYPES[ext] });
  }
  return files;
}

export async function POST(request: Request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || request.headers.get('x-real-ip') || 'unknown';
  if (rateLimited(ip)) return bad('Too many notices from this connection. Please try again in an hour.', 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return bad('Invalid submission.');
  }

  // Honeypot: real users never see or fill this field.
  if (clean(form.get('website'), 200)) return NextResponse.json({ referenceId: 'INF-OK' }, { status: 201 });

  const role = clean(form.get('role'), 200);
  const fullName = clean(form.get('fullName'), 150);
  const organisation = clean(form.get('organisation'), 200);
  const email = clean(form.get('email'), 200);
  const phone = clean(form.get('phone'), 30);
  const videoLink = clean(form.get('videoLink'), 500);
  const rightTypes = clean(form.get('rightTypes'), 300);
  const workTypes = clean(form.get('workTypes'), 300);
  const noticeText = typeof form.get('noticeText') === 'string' ? String(form.get('noticeText')).slice(0, MAX_NOTICE_CHARS) : '';

  if (!ROLES.includes(role)) return bad('Choose how you are submitting this notice.');
  if (!fullName) return bad('Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Enter a valid email address.');
  if (!phone) return bad('Enter your phone number.');
  if (!videoLink) return bad('Enter the link to the video or the video ID.');
  if (!rightTypes || !workTypes) return bad('Choose the type of right and the type of work.');
  if (noticeText.trim().length < 50) return bad('The notice is incomplete.');

  let ownership, authority;
  try {
    ownership = await readFiles(form, 'ownershipProof', 'proof of ownership');
    authority = await readFiles(form, 'authorityProof', 'proof of authority');
  } catch (e: any) {
    return bad(e.message);
  }
  if (ownership.length === 0) return bad('Attach your proof of ownership or license.');
  if (role === AUTHORISED_ROLE && authority.length === 0) return bad('Attach your proof of authority.');

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const referenceId = `INF-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  let saved: { id: string } | null = null;
  try {
    const stored = [
      ...(await Promise.all(ownership.map((f) => storeNoticeFile(referenceId, f, 'ownership')))),
      ...(await Promise.all(authority.map((f) => storeNoticeFile(referenceId, f, 'authority')))),
    ];
    saved = await prisma.infringementNotice.create({
      data: {
        referenceId, role, fullName, organisation: organisation || null, email, phone,
        videoLink, rightTypes, workTypes, noticeText, files: stored as any,
      },
      select: { id: true },
    });
  } catch (e) {
    // Still try the email below — the notice must reach someone.
    console.error(`Infringement notice ${referenceId} failed to save:`, e);
  }

  let emailSent = false;
  try {
    await sendInfringementNoticeEmail({
      referenceId,
      complainantName: fullName,
      complainantEmail: email,
      noticeText,
      files: [...ownership, ...authority],
    });
    emailSent = true;
  } catch (e) {
    console.error(`Infringement notice ${referenceId} failed to email:`, e);
  }

  if (!saved && !emailSent) {
    return bad('We could not receive your notice right now. Please email it to us instead.', 502);
  }
  if (saved && emailSent) {
    await prisma.infringementNotice.update({ where: { id: saved.id }, data: { emailSent: true } }).catch(() => {});
  }

  // The notice is recorded; a failed acknowledgement must not report failure.
  sendInfringementAcknowledgementEmail({ to: email, name: fullName, referenceId }).catch((e) =>
    console.error(`Acknowledgement for ${referenceId} to ${email} failed:`, e),
  );

  return NextResponse.json({ referenceId }, { status: 201 });
}
