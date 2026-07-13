import nodemailer from 'nodemailer';

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

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb">
    <div style="background:#004f9f;color:#ffffff;padding:18px 24px">
      <h2 style="margin:0;font-size:20px">Mittmee — School Registration</h2>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      <p>${greeting}</p>
      <p><b>${data.schoolName}</b> has been successfully registered on the Mittmee platform.
      Use the credentials below to log in to your school account:</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>School ID</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px">${data.schoolId}</td>
        </tr>
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>Username</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px;font-family:Consolas,monospace">${data.username}</td>
        </tr>
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>Password</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px;font-family:Consolas,monospace">${data.password}</td>
        </tr>
      </table>
      <p style="color:#b91c1c"><b>Please keep these credentials safe</b> and do not share them outside your school administration.</p>
      <p>Regards,<br/>Team Mittmee</p>
    </div>
    <div style="background:#f3f4f6;color:#6b7280;padding:12px 24px;font-size:11px">
      This is an automated email — please do not reply.
    </div>
  </div>`;

  await getTransporter().sendMail({
    from: SMTP_FROM ? `Mittmee <${SMTP_FROM}>` : undefined,
    to: data.to,
    subject: `School Registered — Login Credentials for ${data.schoolName}`,
    html,
    text:
      `${greeting}\n\n${data.schoolName} has been registered on Mittmee.\n\n` +
      `School ID: ${data.schoolId}\nUsername: ${data.username}\nPassword: ${data.password}\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittmee`,
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

export interface StudentCredentialsMail {
  to: string;
  studentName: string;
  olympiadCode: string;
  userId: string;
  password: string;
}

export async function sendStudentCredentialsEmail(data: StudentCredentialsMail): Promise<void> {
  if (!isMailerConfigured()) {
    console.log(
      `[MAILER not configured] Credentials for ${data.studentName} (${data.to}): ` +
        `userId=${data.userId} password=${data.password}`
    );
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS in .env)');
  }

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb">
    <div style="background:#06013E;color:#ffffff;padding:18px 24px">
      <h2 style="margin:0;font-size:20px">Mittmee — Olympiad ID Allotted</h2>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      <p>Dear ${data.studentName},</p>
      <p>Your school has allotted you an Olympiad ID on the Mittmee platform.
      Use the details below to log in to the Mittmee app:</p>
      <table style="border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>Olympiad ID</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px;font-family:Consolas,monospace">${data.olympiadCode}</td>
        </tr>
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>User ID</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px;font-family:Consolas,monospace">${data.userId}</td>
        </tr>
        <tr>
          <td style="border:1px solid #d1d5db;padding:8px 14px;background:#f9fafb"><b>Password</b></td>
          <td style="border:1px solid #d1d5db;padding:8px 14px;font-family:Consolas,monospace">${data.password}</td>
        </tr>
      </table>
      <p>You can log in to the app using your registered phone number and this password.</p>
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
    subject: `Your Mittmee Olympiad ID & Login Credentials`,
    html,
    text:
      `Dear ${data.studentName},\n\nYour school has allotted you an Olympiad ID on Mittmee.\n\n` +
      `Olympiad ID: ${data.olympiadCode}\nUser ID: ${data.userId}\nPassword: ${data.password}\n\n` +
      `Log in to the app using your registered phone number and this password.\n\n` +
      `Please keep these credentials safe.\n\nRegards,\nTeam Mittmee`,
  });
}
