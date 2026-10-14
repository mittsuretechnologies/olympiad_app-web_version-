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

/** Where the "Login Now" button in the school credentials email points to. */
const ADMIN_LOGIN_URL = 'https://admin.mittmee.com/login';

export interface SchoolCredentialsMail {
  to: string;
  schoolName: string;
  username: string;
  password: string;
}

// Only what the school needs to log in (username + password) — the internal
// School ID is deliberately left out of the email.
export async function sendSchoolCredentialsEmail(data: SchoolCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    // Dev fallback so registration keeps working before SMTP is set up.
    console.log(
      `[MAILER not configured] Credentials for ${data.schoolName} (${data.to}): ` +
        `username=${data.username} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  // Addressed to the school itself, never to the coordinator/contact person
  // on record — the credentials belong to the school.
  const greeting = `Dear ${data.schoolName},`;

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
        ${credentialRow('Username', data.username)}
        ${credentialRow('Password', data.password, true)}
      </table>

      <!-- Bulletproof button: background colour + padding on the <td>, not the
           <a>, so Outlook's Word engine (which ignores padding/border-radius on
           inline elements) still renders a solid, clickable block. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">
        <tr><td style="background:#1552B6;border-radius:8px;">
          <a href="${ADMIN_LOGIN_URL}" target="_blank"
             style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;
                    font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">
            Login Now &rarr;
          </a>
        </td></tr>
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
      `Username: ${data.username}\nPassword: ${data.password}\n\n` +
      `Login here: ${ADMIN_LOGIN_URL}\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittsure`,
  });
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  purpose: 'signup' | 'reset' | 'delete' = 'signup'
): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(`[MAILER not configured] OTP for ${to}: ${otp}`);
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const copy = {
    signup: {
      heading: 'Mittmee — Verification Code',
      line: 'Use this code to verify your email and create your Mittmee account:',
      subject: `${otp} is your Mittmee verification code`,
      text: `Your Mittmee verification code is ${otp}. It expires in 5 minutes.`,
      ignore: "If you didn't request this, you can safely ignore this email.",
    },
    reset: {
      heading: 'Mittmee — Password Reset Code',
      line: 'Use this code to reset the password of your Mittmee account:',
      subject: `${otp} is your Mittmee password reset code`,
      text: `Use this code to reset the password of your Mittmee account: ${otp}. It expires in 5 minutes.`,
      ignore: "If you didn't request this, you can safely ignore this email.",
    },
    // A deletion code is the one that matters if it was NOT the user: someone
    // holding their session is trying to delete the account.
    delete: {
      heading: 'Mittmee — Account Deletion Code',
      line: 'Use this code to confirm the request to delete your Mittmee account:',
      subject: `${otp} is your Mittmee account deletion code`,
      text: `Use this code to confirm deleting your Mittmee account: ${otp}. It expires in 5 minutes. If you did not ask to delete your account, do not share this code and change your password.`,
      ignore: "If you didn't ask to delete your account, do not share this code with anyone and change your password. Your account will not be deleted without it.",
    },
  }[purpose];
  const { heading, line } = copy;

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
      <p style="color:#6b7280;font-size:12px">${copy.ignore}</p>
    </div>
    <div style="background:#f3f4f6;color:#6b7280;padding:12px 24px;font-size:11px">
      This is an automated email — please do not reply.
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to,
    subject: copy.subject,
    html,
    text: copy.text,
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

export interface UploaderCredentialsMail {
  to: string;
  uploaderName: string;
  uploaderId: string;
  username: string;
  password: string;
}

export async function sendUploaderCredentialsEmail(data: UploaderCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(
      `[MAILER not configured] Credentials for ${data.uploaderName} (${data.to}): ` +
        `username=${data.username} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = renderEmailShell({
    title: `Uploader Account — ${data.uploaderName}`,
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">Uploader Account Created</p>
      <p style="margin:0 0 14px;font-size:14px;">Dear <b>${escapeHtml(data.uploaderName)}</b>,</p>
      <p style="margin:0 0 16px;">
        An uploader account has been created for you on the Mittmee platform.
        Use the credentials below to log in and start uploading answer sheets.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #E4ECF7;border-radius:8px;overflow:hidden;margin:0 0 16px;">
        ${credentialRow('Uploader ID', data.uploaderId)}
        ${credentialRow('Username', data.username)}
        ${credentialRow('Password', data.password, true)}
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#FDF0F0;border-left:3px solid #C0392B;border-radius:6px;margin:0 0 16px;">
        <tr><td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#8C2A20;line-height:1.5;">
          <b>Keep these credentials safe.</b> Do not share them with anyone.
        </td></tr>
      </table>

      <p style="margin:0;font-size:13.5px;color:#5A6B80;">Regards,<br><b style="color:#0B2A5C;">Team Mittsure</b></p>
    `,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: 'Your Mittmee Uploader Login Credentials',
    html,
    attachments: emailAttachments(),
    text:
      `Dear ${data.uploaderName},\n\nAn uploader account has been created for you on Mittmee.\n\n` +
      `Uploader ID: ${data.uploaderId}\nUsername: ${data.username}\nPassword: ${data.password}\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittsure`,
  });
}

export interface ReviewerCredentialsMail {
  to: string;
  reviewerName: string;
  reviewerId: string;
  password: string;
}

export async function sendReviewerCredentialsEmail(data: ReviewerCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(
      `[MAILER not configured] Credentials for ${data.reviewerName} (${data.to}): ` +
        `reviewerId=${data.reviewerId} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = renderEmailShell({
    title: `Reviewer Account — ${data.reviewerName}`,
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">Reviewer Account Created</p>
      <p style="margin:0 0 14px;font-size:14px;">Dear <b>${escapeHtml(data.reviewerName)}</b>,</p>
      <p style="margin:0 0 16px;">
        A reviewer account has been created for you on the Mittmee platform.
        Use the credentials below to log in and start reviewing content.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #E4ECF7;border-radius:8px;overflow:hidden;margin:0 0 16px;">
        ${credentialRow('Reviewer ID', data.reviewerId)}
        ${credentialRow('Password', data.password, true)}
      </table>

      <p style="margin:0 0 16px;">Log in with your <b>Reviewer ID</b> and the password above — not your email address.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#FDF0F0;border-left:3px solid #C0392B;border-radius:6px;margin:0 0 16px;">
        <tr><td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#8C2A20;line-height:1.5;">
          <b>Keep these credentials safe.</b> Do not share them with anyone.
        </td></tr>
      </table>

      <p style="margin:0;font-size:13.5px;color:#5A6B80;">Regards,<br><b style="color:#0B2A5C;">Team Mittsure</b></p>
    `,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: 'Your Mittmee Reviewer Login Credentials',
    html,
    attachments: emailAttachments(),
    text:
      `Dear ${data.reviewerName},\n\nA reviewer account has been created for you on Mittmee.\n\n` +
      `Reviewer ID: ${data.reviewerId}\nPassword: ${data.password}\n\n` +
      `Log in with your Reviewer ID and the password above — not your email address.\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittsure`,
  });
}

export interface MasterReviewerCredentialsMail {
  to: string;
  masterReviewerName: string;
  masterReviewerId: string;
  password: string;
}

export async function sendMasterReviewerCredentialsEmail(data: MasterReviewerCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(
      `[MAILER not configured] Credentials for ${data.masterReviewerName} (${data.to}): ` +
        `masterReviewerId=${data.masterReviewerId} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = renderEmailShell({
    title: `Master Reviewer Account — ${data.masterReviewerName}`,
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">Master Reviewer Account Created</p>
      <p style="margin:0 0 14px;font-size:14px;">Dear <b>${escapeHtml(data.masterReviewerName)}</b>,</p>
      <p style="margin:0 0 16px;">
        A Master Reviewer account has been created for you. Use the credentials below to log in
        to the Olympiad Checker portal.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #E4ECF7;border-radius:8px;overflow:hidden;margin:0 0 16px;">
        ${credentialRow('Master Reviewer ID', data.masterReviewerId)}
        ${credentialRow('Password', data.password, true)}
      </table>

      <p style="margin:0 0 16px;">Log in with your <b>Master Reviewer ID</b> and the password above — not your email address.</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#FDF0F0;border-left:3px solid #C0392B;border-radius:6px;margin:0 0 16px;">
        <tr><td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#8C2A20;line-height:1.5;">
          <b>Keep these credentials safe.</b> Do not share them with anyone.
        </td></tr>
      </table>

      <p style="margin:0;font-size:13.5px;color:#5A6B80;">Regards,<br><b style="color:#0B2A5C;">Team Mittsure</b></p>
    `,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: 'Your Mittmee Master Reviewer Login Credentials',
    html,
    attachments: emailAttachments(),
    text:
      `Dear ${data.masterReviewerName},\n\nA Master Reviewer account has been created for you.\n\n` +
      `Master Reviewer ID: ${data.masterReviewerId}\nPassword: ${data.password}\n\n` +
      `Log in with your Master Reviewer ID and the password above — not your email address.\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittsure`,
  });
}

/* ── Video removed after a report ─────────────────────────────────────────── */

export interface VideoRemovedMail {
  to: string;
  guardianName?: string | null;
  childName?: string | null;
  videoLabel: string;
}

// App accounts for children are registered with a parent's email, so this is
// addressed to the parent/guardian rather than the child.
export async function sendVideoRemovedEmail(data: VideoRemovedMail): Promise<void> {
  if (!isMailerConfigured()) {
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const greeting = data.guardianName ? `Dear ${data.guardianName},` : 'Dear Parent/Guardian,';
  const whose = data.childName ? `${data.childName}'s video` : 'A video from your Mittmee account';

  const html = renderEmailShell({
    title: 'A video was removed from Mittmee',
    body: `
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;">${escapeHtml(whose)}, <b>"${escapeHtml(data.videoLabel)}"</b>, has been removed from Mittmee.
        It was reported by other users and, after review, our moderation team found that it does not follow our Community Guidelines.</p>
      <p style="margin:0 0 12px;">The video is no longer visible to anyone on the app. Your account remains active, and you can continue to share new videos that follow the guidelines.</p>
      <p style="margin:0 0 12px;">If you believe this was a mistake, please contact us through <b>Help &amp; Support</b> in the Mittmee app.</p>
      <p style="margin:0;">Regards,<br>Team Mittsure</p>`,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: 'A video was removed from Mittmee',
    html,
    attachments: emailAttachments(),
    text:
      `${greeting}\n\n${whose}, "${data.videoLabel}", has been removed from Mittmee. It was reported by other users and, ` +
      `after review, our moderation team found that it does not follow our Community Guidelines.\n\n` +
      `The video is no longer visible to anyone on the app. Your account remains active, and you can continue to share ` +
      `new videos that follow the guidelines.\n\nIf you believe this was a mistake, please contact us through Help & Support ` +
      `in the Mittmee app.\n\nRegards,\nTeam Mittsure`,
  });
}

/* ── Infringement notices (public landing-page form) ─────────────────────── */

export const GRIEVANCE_EMAIL = process.env.GRIEVANCE_EMAIL || 'grievance@mittsure.com';

export interface InfringementNoticeMail {
  referenceId: string;
  complainantName: string;
  complainantEmail: string;
  noticeText: string;
  files: { filename: string; content: Buffer; contentType: string }[];
}

export async function sendInfringementNoticeEmail(data: InfringementNoticeMail): Promise<void> {
  if (!isMailerConfigured()) {
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: GRIEVANCE_EMAIL,
    replyTo: `${data.complainantName} <${data.complainantEmail}>`,
    subject: `Infringement Notice ${data.referenceId} – ${data.complainantName}`,
    text: `Reference: ${data.referenceId}\n\n${data.noticeText}`,
    html:
      `<p style="font-family:Arial,sans-serif;font-size:13px;color:#243244;">` +
      `Reference: <b>${escapeHtml(data.referenceId)}</b> &middot; Submitted via mittmee.com. ` +
      `Reply to this email to contact the complainant. Proof documents are attached.</p>` +
      `<pre style="font-family:Consolas,'Courier New',monospace;font-size:12.5px;white-space:pre-wrap;color:#0B2A5C;">` +
      `${escapeHtml(data.noticeText)}</pre>`,
    attachments: data.files,
  });
}

export async function sendInfringementAcknowledgementEmail(data: {
  to: string;
  name: string;
  referenceId: string;
}): Promise<void> {
  if (!isMailerConfigured()) {
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = renderEmailShell({
    title: 'We received your infringement notice',
    body: `
      <p style="margin:0 0 12px;">Dear ${escapeHtml(data.name)},</p>
      <p style="margin:0 0 12px;">We have received your infringement notice. Your reference number is:</p>
      <p style="margin:0 0 16px;font-family:Consolas,'Courier New',monospace;font-size:18px;font-weight:bold;color:#1552B6;">${escapeHtml(data.referenceId)}</p>
      <p style="margin:0 0 12px;">Our grievance team will review it and contact you at this email address. Please quote the reference number in any correspondence with
        <a href="mailto:${GRIEVANCE_EMAIL}" style="color:#1552B6;">${GRIEVANCE_EMAIL}</a>.</p>
      <p style="margin:0;">Regards,<br>Team Mittsure</p>`,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: `We received your infringement notice (${data.referenceId})`,
    html,
    attachments: emailAttachments(),
    text:
      `Dear ${data.name},\n\nWe have received your infringement notice.\nReference number: ${data.referenceId}\n\n` +
      `Our grievance team will review it and contact you at this email address. ` +
      `Please quote the reference number when writing to ${GRIEVANCE_EMAIL}.\n\nRegards,\nTeam Mittsure`,
  });
}

/* ── Copyright takedown (Infringement Policy 5–6) ─────────────────────────── */

export interface CopyrightTakedownMail {
  to: string;
  guardianName?: string | null;
  childName?: string | null;
  videoLabel: string;
  referenceId: string;
  reviewDate: string; // already formatted for display
}

// Addressed to the parent/guardian, like sendVideoRemovedEmail.
export async function sendCopyrightTakedownEmail(data: CopyrightTakedownMail): Promise<void> {
  if (!isMailerConfigured()) {
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const greeting = data.guardianName ? `Dear ${data.guardianName},` : 'Dear Parent/Guardian,';
  const whose = data.childName ? `${data.childName}'s video` : 'A video from your Mittmee account';

  const html = renderEmailShell({
    title: 'A video was removed following a copyright complaint',
    body: `
      <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;">${escapeHtml(whose)}, <b>"${escapeHtml(data.videoLabel)}"</b>, has been removed from Mittmee following a copyright complaint
        (reference <b>${escapeHtml(data.referenceId)}</b>).</p>
      <p style="margin:0 0 12px;">Under our Infringement Policy the video stays unavailable until at least <b>${escapeHtml(data.reviewDate)}</b>, after which we will review it.</p>
      <p style="margin:0 0 12px;">If you believe this is a mistake, or that you have the right to use the content, write to
        <a href="mailto:${GRIEVANCE_EMAIL}" style="color:#1552B6;">${GRIEVANCE_EMAIL}</a> quoting the reference. We will share your response with the complainant
        and take it into account at the review.</p>
      <p style="margin:0;">Regards,<br>Team Mittsure</p>`,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: 'A video was removed following a copyright complaint',
    html,
    attachments: emailAttachments(),
    text:
      `${greeting}\n\n${whose}, "${data.videoLabel}", has been removed from Mittmee following a copyright complaint ` +
      `(reference ${data.referenceId}).\n\nUnder our Infringement Policy the video stays unavailable until at least ` +
      `${data.reviewDate}, after which we will review it.\n\nIf you believe this is a mistake, or that you have the right ` +
      `to use the content, write to ${GRIEVANCE_EMAIL} quoting the reference. We will share your response with the ` +
      `complainant and take it into account at the review.\n\nRegards,\nTeam Mittsure`,
  });
}

export interface CopyrightReviewReminderItem {
  referenceId: string;
  complainantName: string;
  videoLabel: string;
  reviewDate: string;
  overdue: boolean;
}

// Daily digest to the grievance inbox of 21-day reviews that are due soon or overdue.
export async function sendCopyrightReviewReminderEmail(items: CopyrightReviewReminderItem[], dashboardUrl: string): Promise<void> {
  if (!isMailerConfigured()) {
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const rows = items.map((i) =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #E3E8F0;font-family:Consolas,monospace;">${escapeHtml(i.referenceId)}</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #E3E8F0;">${escapeHtml(i.complainantName)}</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #E3E8F0;">${escapeHtml(i.videoLabel)}</td>` +
    `<td style="padding:6px 8px;border-bottom:1px solid #E3E8F0;${i.overdue ? 'color:#B42318;font-weight:bold;' : ''}">` +
    `${escapeHtml(i.reviewDate)}${i.overdue ? ' (overdue)' : ''}</td></tr>`).join('');

  const html = renderEmailShell({
    title: 'Copyright takedown reviews due',
    body: `
      <p style="margin:0 0 12px;">The following videos were disabled following a copyright complaint and have reached, or are about to reach,
        the end of the 21-day period under the Infringement Policy. For each one, check whether the complainant has produced a court order,
        then restore the video or remove it permanently.</p>
      <table style="border-collapse:collapse;font-size:13px;margin:0 0 16px;">
        <tr><th align="left" style="padding:6px 8px;">Reference</th><th align="left" style="padding:6px 8px;">Complainant</th>
          <th align="left" style="padding:6px 8px;">Video</th><th align="left" style="padding:6px 8px;">Review date</th></tr>
        ${rows}
      </table>
      <p style="margin:0;"><a href="${escapeHtml(dashboardUrl)}" style="color:#1552B6;">Open Report Infringement in the admin panel</a></p>`,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: GRIEVANCE_EMAIL,
    subject: `Copyright takedown review${items.length === 1 ? '' : 's'} due (${items.length})`,
    html,
    attachments: emailAttachments(),
    text:
      `These videos were disabled following a copyright complaint and their 21-day review is due:\n\n` +
      items.map((i) => `${i.referenceId} · ${i.complainantName} · "${i.videoLabel}" · ${i.reviewDate}${i.overdue ? ' (overdue)' : ''}`).join('\n') +
      `\n\nRestore or remove each one at ${dashboardUrl}`,
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

/* ── Legal agreements ────────────────────────────────────────────────────── */

/**
 * OTP that verifies an agreement acceptance (Section 18.2(b) of the School
 * Onboarding Agreement). Worded for that purpose rather than reusing the
 * signup/reset copy, so the recipient knows what they are confirming.
 */
export async function sendAgreementOtpEmail(data: {
  to: string;
  otp: string;
  schoolName: string;
  signatoryName: string;
  agreementTitle: string;
}): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(`[MAILER not configured] Agreement OTP for ${data.to}: ${data.otp}`);
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = renderEmailShell({
    title: `Verify acceptance — ${data.agreementTitle}`,
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">Verify agreement acceptance</p>
      <p style="margin:0 0 14px;">
        <b>${escapeHtml(data.signatoryName)}</b> is accepting the <b>${escapeHtml(data.agreementTitle)}</b>
        on behalf of <b>${escapeHtml(data.schoolName)}</b>. Enter this code on the School Panel to verify the acceptance:
      </p>
      <p style="font-size:30px;font-weight:bold;letter-spacing:8px;text-align:center;background:#F4F8FE;
                border:1px solid #E4ECF7;border-radius:8px;padding:14px 0;margin:0 0 16px;
                font-family:Consolas,'Courier New',monospace;color:#0B2A5C;">${escapeHtml(data.otp)}</p>
      <p style="margin:0 0 16px;font-size:13px;color:#5A6B80;">This code expires in <b>5 minutes</b>.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:#FDF0F0;border-left:3px solid #C0392B;border-radius:6px;margin:0 0 16px;">
        <tr><td style="padding:10px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#8C2A20;line-height:1.5;">
          <b>Didn't expect this?</b> Do not share the code. Someone may be trying to accept a legal agreement
          on behalf of your school — contact support@mittsure.com.
        </td></tr>
      </table>
      <p style="margin:0;font-size:13.5px;color:#5A6B80;">Regards,<br><b style="color:#0B2A5C;">Team Mittsure</b></p>
    `,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: `${data.otp} is your code to verify the ${data.agreementTitle}`,
    html,
    attachments: emailAttachments(),
    text:
      `${data.signatoryName} is accepting the ${data.agreementTitle} on behalf of ${data.schoolName}.\n\n` +
      `Verification code: ${data.otp} (expires in 5 minutes).\n\n` +
      `If you didn't expect this, do not share the code and contact support@mittsure.com.\n\nRegards,\nTeam Mittsure`,
  });
}

export interface AgreementCopyMail {
  to: string[];
  schoolName: string;
  agreementTitle: string;
  /** Label/value rows describing the acceptance record. */
  record: { label: string; value: string }[];
  /** Full agreement HTML (already escaped) for the email body. */
  agreementHtml: string;
  /** Canonical plain text of the agreement, attached as a .txt file. */
  agreementText: string;
  attachmentName: string;
}

/**
 * Copy of the accepted agreement plus the acceptance record (Section 18.4).
 * The agreement text goes in the body and as an attachment, so the school
 * keeps a copy even if their client strips long HTML.
 */
export async function sendAgreementCopyEmail(data: AgreementCopyMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(`[MAILER not configured] Agreement copy for ${data.schoolName} -> ${data.to.join(', ')}`);
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const rows = data.record
    .map((r, i) => `<tr>
      <td style="${i < data.record.length - 1 ? 'border-bottom:1px solid #E4ECF7;' : ''}background:#F4F8FE;padding:8px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#1552B6;white-space:nowrap;vertical-align:top;">${escapeHtml(r.label)}</td>
      <td style="${i < data.record.length - 1 ? 'border-bottom:1px solid #E4ECF7;' : ''}padding:8px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0B2A5C;word-break:break-word;">${escapeHtml(r.value)}</td>
    </tr>`)
    .join('');

  const html = renderEmailShell({
    title: `${data.agreementTitle} — accepted`,
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">Agreement accepted</p>
      <p style="margin:0 0 16px;">
        This confirms that the <b>${escapeHtml(data.agreementTitle)}</b> has been accepted electronically on behalf of
        <b>${escapeHtml(data.schoolName)}</b>. Please keep this email for your records.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #E4ECF7;border-radius:8px;overflow:hidden;margin:0 0 20px;">${rows}</table>
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#0B2A5C;">Full text of the accepted Agreement</p>
      <div style="border:1px solid #E4ECF7;border-radius:8px;padding:14px 16px;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:#243244;">
        ${data.agreementHtml}
      </div>
      <p style="margin:16px 0 0;font-size:13.5px;color:#5A6B80;">Regards,<br><b style="color:#0B2A5C;">Team Mittsure</b></p>
    `,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: `Accepted: ${data.agreementTitle} — ${data.schoolName}`,
    html,
    attachments: [
      ...emailAttachments(),
      { filename: data.attachmentName, content: data.agreementText, contentType: 'text/plain; charset=utf-8' },
    ],
    text:
      `The ${data.agreementTitle} has been accepted electronically on behalf of ${data.schoolName}.\n\n` +
      data.record.map(r => `${r.label}: ${r.value}`).join('\n') +
      `\n\nThe full text of the accepted Agreement is attached.\n\nRegards,\nTeam Mittsure`,
  });
}

/* ── School Panel Help & Support ─────────────────────────────────────────── */

/** Inbox the support team watches for new school requests and replies. */
const SCHOOL_SUPPORT_EMAIL = process.env.SCHOOL_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || 'support@mittsure.com';

/** Base URL of the web panels, for "open this request" links. Omitted when unset. */
const PANEL_URL = (process.env.PANEL_URL || process.env.SERVER_URL || '').replace(/\/+$/, '');

export interface SchoolSupportTeamMail {
  event: 'NEW' | 'SCHOOL_REPLY';
  ticketRef: string;
  ticketId: string;
  subject: string;
  category: string;
  priority: string;
  schoolName: string;
  schoolCode: string;
  schoolEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  message: string;
  attachmentCount: number;
}

/**
 * Tells the support inbox a school raised a request or replied on one. The
 * school's email is set as Reply-To for a quick personal follow-up, but the
 * answer the school sees in its panel has to be written on the dashboard.
 */
export async function sendSchoolSupportTeamEmail(data: SchoolSupportTeamMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(`[MAILER not configured] School support ${data.event} ${data.ticketRef} from ${data.schoolCode}`);
    return;
  }

  const heading = data.event === 'NEW' ? 'New support request' : 'School replied';
  const link = PANEL_URL ? `${PANEL_URL}/dashboard/school-support?ticket=${encodeURIComponent(data.ticketId)}` : null;
  const rows: [string, string][] = [
    ['Reference', data.ticketRef],
    ['School', `${data.schoolName} (${data.schoolCode})`],
    ['Category', data.category],
    ['Priority', data.priority === 'URGENT' ? 'Urgent' : 'Normal'],
    ...(data.contactName ? [['Contact person', data.contactName] as [string, string]] : []),
    ...(data.contactPhone ? [['Contact phone', data.contactPhone] as [string, string]] : []),
    ...(data.attachmentCount ? [['Attachments', `${data.attachmentCount} file(s) — open the request to view`] as [string, string]] : []),
  ];

  const html = renderEmailShell({
    title: `${heading} — ${data.ticketRef}`,
    body: `
      <p style="margin:0 0 4px;font-size:17px;font-weight:bold;color:#0B2A5C;">${escapeHtml(heading)}: ${escapeHtml(data.subject)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #E4ECF7;border-radius:8px;overflow:hidden;margin:12px 0 16px;">
        ${rows.map(([k, v], i) => `<tr>
          <td style="${i < rows.length - 1 ? 'border-bottom:1px solid #E4ECF7;' : ''}background:#F4F8FE;padding:8px 12px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#1552B6;white-space:nowrap;">${escapeHtml(k)}</td>
          <td style="${i < rows.length - 1 ? 'border-bottom:1px solid #E4ECF7;' : ''}padding:8px 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0B2A5C;">${escapeHtml(v)}</td>
        </tr>`).join('')}
      </table>
      <div style="border-left:3px solid #1552B6;background:#F4F8FE;border-radius:6px;padding:10px 14px;margin:0 0 16px;font-size:13.5px;color:#243244;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
      ${link ? `<p style="margin:0 0 12px;"><a href="${escapeHtml(link)}" style="color:#1552B6;font-weight:bold;">Open the request on the dashboard →</a></p>` : ''}
      <p style="margin:0;font-size:12.5px;color:#5A6B80;">Reply from the dashboard so the school sees it in their panel.</p>`,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: SCHOOL_SUPPORT_EMAIL,
    ...(data.schoolEmail ? { replyTo: `${data.schoolName} <${data.schoolEmail}>` } : {}),
    subject: `[${data.ticketRef}]${data.priority === 'URGENT' ? ' [URGENT]' : ''} ${heading}: ${data.subject} — ${data.schoolName}`,
    html,
    attachments: emailAttachments(),
    text:
      `${heading}: ${data.subject}\n\n` +
      rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
      `\n\n${data.message}\n\n` +
      (link ? `Open: ${link}\n` : '') +
      `Reply from the dashboard so the school sees it in their panel.`,
  });
}

export interface SchoolSupportSchoolMail {
  event: 'RECEIVED' | 'TEAM_REPLY' | 'RESOLVED';
  to: string;
  schoolName: string;
  ticketRef: string;
  subject: string;
  /** The team's reply, for TEAM_REPLY / RESOLVED-with-note. */
  message?: string | null;
}

/** Keeps the school informed: request received, team replied, request resolved. */
export async function sendSchoolSupportSchoolEmail(data: SchoolSupportSchoolMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(`[MAILER not configured] School support ${data.event} ${data.ticketRef} -> ${data.to}`);
    return;
  }

  const link = PANEL_URL ? `${PANEL_URL}/school/support` : null;
  const copy = {
    RECEIVED: {
      title: `We received your request ${data.ticketRef}`,
      lead: `Thank you for contacting Mittmee support. We have received your request and our team will get back to you soon. Your reference number is:`,
    },
    TEAM_REPLY: {
      title: `Reply on your request ${data.ticketRef}`,
      lead: `Our support team has replied to your request:`,
    },
    RESOLVED: {
      title: `Your request ${data.ticketRef} has been resolved`,
      lead: `Our support team has marked your request as resolved. If the problem is not fixed, simply reply on the request from your School Panel and it will be reopened.`,
    },
  }[data.event];

  const html = renderEmailShell({
    title: copy.title,
    body: `
      <p style="margin:0 0 12px;">Dear ${escapeHtml(data.schoolName)},</p>
      <p style="margin:0 0 12px;">${escapeHtml(copy.lead)}</p>
      <p style="margin:0 0 12px;"><span style="font-family:Consolas,'Courier New',monospace;font-size:16px;font-weight:bold;color:#1552B6;">${escapeHtml(data.ticketRef)}</span>
        &nbsp;·&nbsp; <b>${escapeHtml(data.subject)}</b></p>
      ${data.message ? `<div style="border-left:3px solid #2E9E46;background:#F3FAF5;border-radius:6px;padding:10px 14px;margin:0 0 16px;font-size:13.5px;color:#243244;white-space:pre-wrap;">${escapeHtml(data.message)}</div>` : ''}
      <p style="margin:0 0 12px;">You can view the full conversation and reply under <b>Help &amp; Support</b> in your School Panel${link ? ` — <a href="${escapeHtml(link)}" style="color:#1552B6;">open it here</a>` : ''}.</p>
      <p style="margin:0;">Regards,<br>Team Mittsure</p>`,
  });

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: `[${data.ticketRef}] ${copy.title.replace(` ${data.ticketRef}`, '')}: ${data.subject}`,
    html,
    attachments: emailAttachments(),
    text:
      `Dear ${data.schoolName},\n\n${copy.lead}\n\n${data.ticketRef} · ${data.subject}\n\n` +
      (data.message ? `${data.message}\n\n` : '') +
      `View the full conversation and reply under Help & Support in your School Panel${link ? `: ${link}` : ''}.\n\nRegards,\nTeam Mittsure`,
  });
}
