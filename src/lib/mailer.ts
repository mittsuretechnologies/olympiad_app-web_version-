import nodemailer from 'nodemailer';
import path from 'path';

// SMTP config comes from .env. With Gmail/Google Workspace, SMTP_USER is the
// mailbox address and SMTP_PASS is an App Password (not the account password).
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

export function isMailerConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/* ── Branded email shell ─────────────────────────────────────────────────── */

/**
 * Images are attached and referenced by CID rather than linked to a public URL:
 * Gmail and Outlook block remote images by default, so a URL-based mascot would
 * be an empty box for most recipients until they click "show images".
 */
const EMAIL_IMAGES = [
  { cid: 'binku', file: 'binku.png' },
  { cid: 'mittmeelogo', file: 'logo.png' },
];

function emailAttachments() {
  return EMAIL_IMAGES.map(img => ({
    filename: img.file,
    path: path.join(process.cwd(), 'public', 'email', img.file),
    cid: img.cid,
  }));
}

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/**
 * Wraps body content in the Mittmee shell: blue header band with the logo,
 * Binku alongside a white content card, and the automated-email footer.
 *
 * Built with nested tables and inline styles because Outlook's Word rendering
 * engine ignores flexbox, grid, and most external CSS.
 */
function renderEmailShell(opts: { title: string; body: string }): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>
  @media only screen and (max-width:480px) {
    .binku-col { display:none !important; width:0 !important; padding:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#EEF3FB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF3FB;padding:20px 12px;">
<tr><td align="center">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(11,42,92,0.12);">

  <!-- Header. The wordmark is live text, not baked into the logo image: the
       source logo (public/mittmee-full-logo.jpeg) is icon-over-wordmark, so
       only the icon glyph is cropped out and the "mittmee" text is set here
       at any size. Coloured white + light green rather than the brand's
       blue + green — see the note below on why. -->
  <tr><td style="background:#1552B6;padding:18px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <!-- White chip behind the icon: its blue→green gradient reads as a
               blue smear directly on the header's own blue otherwise. -->
          <td style="vertical-align:middle;padding-right:10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"
                   style="background:#ffffff;border-radius:9px;">
              <tr><td style="padding:5px;">
                <img src="cid:mittmeelogo" width="26" alt=""
                     style="display:block;border:0;outline:none;width:26px;height:auto;">
              </td></tr>
            </table>
          </td>
          <!-- White + light green, not the brand's blue+green pairing: the
               blue half at brand weight is 2.9:1 on this header, well under
               the 4.5:1 minimum for body-sized text. -->
          <td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;letter-spacing:-0.02em;">
            <span style="color:#ffffff;">mitt</span><span style="color:#8FE0A0;">mee</span>
          </td>
        </tr></table>
      </td>
      <td align="right" style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;color:#BFD5F5;font-size:11.5px;line-height:1.45;">
        Empowering Schools,<br>Inspiring Growth
      </td>
    </tr></table>
  </td></tr>

  <!-- Body: Binku column on the left, content on the right -->
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>

      <!-- Binku is dropped under 480px: at phone widths the columns stack and
           the mascot would push the credentials below the fold. The image
           carries its own blue panel, so no column background is needed. -->
      <!-- The image's own panel fades from blue to white top-to-bottom, so no
           flat column colour can seam-match it at both edges. Stretching it to
           100% height instead means there is never a background to match.
           Outlook's Word engine ignores percentage heights on <img>, so there
           it just falls back to the image's natural height — acceptable,
           since Outlook is a minority of opens for this audience. -->
      <td class="binku-col" width="136" style="width:136px;font-size:0;line-height:0;">
        <img src="cid:binku" width="136" height="100%" alt=""
             style="display:block;border:0;outline:none;width:136px;height:100%;min-height:100%;">
      </td>

      <td style="vertical-align:top;padding:22px 22px 22px 18px;font-family:Arial,Helvetica,sans-serif;color:#243244;font-size:14px;line-height:1.6;">
        ${opts.body}
      </td>

    </tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#1552B6;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;color:#C9DCF7;font-size:11.5px;">
    This is an automated email — please do not reply.
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/** Two-column credential row with a coloured label cell. */
function credentialRow(label: string, value: string, last = false): string {
  const border = last ? '' : 'border-bottom:1px solid #E4ECF7;';
  return `<tr>
    <td style="${border}background:#F4F8FE;padding:9px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;font-weight:bold;color:#1552B6;white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="${border}padding:9px 12px;font-family:Consolas,'Courier New',monospace;font-size:14px;color:#0B2A5C;font-weight:bold;letter-spacing:0.3px;">${escapeHtml(value)}</td>
  </tr>`;
}

export interface SchoolCredentialsMail {
  to: string;
  schoolName: string;
  schoolId: string;
  username: string;
  password: string;
  contactPerson?: string | null;
}

export async function sendSchoolCredentialsEmail(data: SchoolCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    // Dev fallback so registration keeps working before SMTP is set up.
    console.log(
      `[MAILER not configured] Credentials for ${data.schoolName} (${data.to}): ` +
        `username=${data.username} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const greeting = data.contactPerson ? `Dear ${data.contactPerson},` : 'Dear Principal,';

  const html = renderEmailShell({
    title: `School Registered — ${data.schoolName}`,
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">School Registered</p>
      <p style="margin:0 0 14px;font-size:14px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 16px;">
        <b>${escapeHtml(data.schoolName)}</b> has been successfully registered on the Mittmee platform.
        Use the credentials below to log in to your school account.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #E4ECF7;border-radius:8px;overflow:hidden;margin:0 0 16px;">
        ${credentialRow('School ID', data.schoolId)}
        ${credentialRow('Username', data.username)}
        ${credentialRow('Password', data.password, true)}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#FDF0F0;border-left:3px solid #C0392B;border-radius:6px;margin:0 0 16px;">
        <tr><td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#8C2A20;line-height:1.5;">
          <b>Keep these credentials safe.</b> Do not share them outside your school administration.
        </td></tr>
      </table>

      <p style="margin:0;font-size:13.5px;color:#5A6B80;">Regards,<br><b style="color:#0B2A5C;">Team Mittsure</b></p>
    `,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: `School Registered — Login Credentials for ${data.schoolName}`,
    html,
    attachments: emailAttachments(),
    text:
      `${greeting}\n\n${data.schoolName} has been registered on Mittmee.\n\n` +
      `School ID: ${data.schoolId}\nUsername: ${data.username}\nPassword: ${data.password}\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittsure`,
  });
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  purpose: 'signup' | 'reset' = 'signup'
): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(`[MAILER not configured] OTP for ${to}: ${otp}`);
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const heading = purpose === 'reset' ? 'Mittmee — Password Reset Code' : 'Mittmee — Verification Code';
  const line =
    purpose === 'reset'
      ? 'Use this code to reset the password of your Mittmee account:'
      : 'Use this code to verify your email and create your Mittmee account:';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;border:1px solid #e5e7eb">
    <div style="background:#06013E;color:#ffffff;padding:18px 24px">
      <h2 style="margin:0;font-size:20px">${heading}</h2>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      <p>${line}</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;
                background:#f9fafb;border:1px solid #d1d5db;padding:14px 0;margin:18px 0;
                font-family:Consolas,monospace;color:#06013E">${otp}</p>
      <p>This code expires in <b>5 minutes</b>.</p>
      <p style="color:#6b7280;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div style="background:#f3f4f6;color:#6b7280;padding:12px 24px;font-size:11px">
      This is an automated email — please do not reply.
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to,
    subject:
      purpose === 'reset'
        ? `${otp} is your Mittmee password reset code`
        : `${otp} is your Mittmee verification code`,
    html,
    text:
      purpose === 'reset'
        ? `Use this code to reset the password of your Mittmee account: ${otp}. It expires in 5 minutes.`
        : `Your Mittmee verification code is ${otp}. It expires in 5 minutes.`,
  });
}

export interface EvaluatorCredentialsMail {
  to: string;
  evaluatorName: string;
  evaluatorId: string;
  password: string;
}

export async function sendEvaluatorCredentialsEmail(data: EvaluatorCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(
      `[MAILER not configured] Credentials for ${data.evaluatorName} (${data.to}): ` +
        `evaluatorId=${data.evaluatorId} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb">
    <div style="background:#004f9f;color:#ffffff;padding:18px 24px">
      <h2 style="margin:0;font-size:20px">Mittmee — Evaluator Account</h2>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      <p>Dear ${data.evaluatorName},</p>
      <p>An evaluator account has been created for you on the Mittmee platform.
      Use the credentials below to log in and start evaluating submissions:</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>Evaluator ID</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px;font-family:Consolas,monospace">${data.evaluatorId}</td>
        </tr>
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>Password</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px;font-family:Consolas,monospace">${data.password}</td>
        </tr>
      </table>
      <p>Log in with your <b>Evaluator ID</b> and the password above — not your email address.</p>
      <p style="color:#b91c1c"><b>Please keep these credentials safe</b> and do not share them with anyone.</p>
      <p>Regards,<br/>Team Mittmee</p>
    </div>
    <div style="background:#f3f4f6;color:#6b7280;padding:12px 24px;font-size:11px">
      This is an automated email — please do not reply.
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: 'Your Mittmee Evaluator Login Credentials',
    html,
    text:
      `Dear ${data.evaluatorName},\n\nAn evaluator account has been created for you on Mittmee.\n\n` +
      `Evaluator ID: ${data.evaluatorId}\nPassword: ${data.password}\n\n` +
      `Log in with your Evaluator ID and the password above — not your email address.\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittmee`,
  });
}

/** Where "Mittmee app" links out to in the credentials email. */
const MITTMEE_APP_URL =
  'https://play.google.com/store/apps/details?id=com.mittmee.app&pcampaignid=web_share';

export interface StudentCredentialsMail {
  to: string;
  studentName: string;
  /** School display name — shown as "Your school, <name>, has allotted…". Falls
   *  back to generic phrasing if a caller doesn't have it on hand yet. */
  schoolName?: string | null;
  olympiadCode: string;
  userId: string;
  password: string;
}

/** Exported so the template can be rendered and previewed without sending. */
export function renderStudentCredentialsHtml(data: StudentCredentialsMail): string {
  const schoolClause = data.schoolName
    ? `Your school, <b style="font-style:normal;">${escapeHtml(data.schoolName)}</b>,`
    : 'Your school';

  return renderEmailShell({
    title: 'Your Mittmee Olympiad ID & Login Credentials',
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">Olympiad ID Allotted</p>
      <p style="margin:0 0 14px;font-size:14px;">Dear <b>${escapeHtml(data.studentName)}</b>,</p>

      <!-- Italic for the explanatory copy, per the requested emphasis — the
           credential table and the safety warning stay upright so the values
           inside them are never mistaken for slanted placeholder text. -->
      <p style="margin:0 0 16px;font-style:italic;">
        ${schoolClause} allotted you an Olympiad ID on the Mittmee platform.
        Use the details below to log in to the
        <a href="${MITTMEE_APP_URL}" style="color:#1552B6;font-style:normal;text-decoration:none;">Mittmee app</a>.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #E4ECF7;border-radius:8px;overflow:hidden;margin:0 0 16px;">
        ${credentialRow('Olympiad ID', data.olympiadCode)}
        ${credentialRow('User ID', data.userId)}
        ${credentialRow('Password', data.password, true)}
      </table>

      <p style="margin:0 0 14px;font-style:italic;">
        Log in to the
        <a href="${MITTMEE_APP_URL}" style="color:#1552B6;font-style:normal;text-decoration:none;">Mittmee app</a>
        using your registered phone number and this password.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#FDF0F0;border-left:3px solid #C0392B;border-radius:6px;margin:0 0 16px;">
        <tr><td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#8C2A20;line-height:1.5;">
          <b>Keep these credentials safe.</b> Do not share them with anyone.
        </td></tr>
      </table>

      <p style="margin:0;font-size:13.5px;color:#5A6B80;font-style:italic;">Regards,<br><b style="color:#0B2A5C;font-style:normal;">Team Mittsure</b></p>
    `,
  });
}

export async function sendStudentCredentialsEmail(data: StudentCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(
      `[MAILER not configured] Credentials for ${data.studentName} (${data.to}): ` +
        `userId=${data.userId} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = renderStudentCredentialsHtml(data);
  const schoolClauseText = data.schoolName ? `Your school, ${data.schoolName},` : 'Your school';

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: `Your Mittmee Olympiad ID & Login Credentials`,
    html,
    attachments: emailAttachments(),
    text:
      `Dear ${data.studentName},\n\n${schoolClauseText} allotted you an Olympiad ID on Mittmee.\n\n` +
      `Olympiad ID: ${data.olympiadCode}\nUser ID: ${data.userId}\nPassword: ${data.password}\n\n` +
      `Log in to the Mittmee app (${MITTMEE_APP_URL}) using your registered phone number and this password.\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittsure`,
  });
}
