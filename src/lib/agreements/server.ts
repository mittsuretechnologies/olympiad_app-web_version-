import crypto from 'crypto';
import {
  SCHOOL_AGREEMENT,
  agreementPlainText,
  type AgreementDoc,
  type AgreementItem,
} from './school-onboarding';

/* ── Document fingerprint ────────────────────────────────────────────────── */

let cachedHash: string | null = null;

/** SHA-256 of the canonical agreement text — pins the exact wording accepted. */
export function schoolAgreementHash(): string {
  if (!cachedHash) {
    cachedHash = crypto.createHash('sha256').update(agreementPlainText(SCHOOL_AGREEMENT), 'utf8').digest('hex');
  }
  return cachedHash;
}

/* ── Request metadata ────────────────────────────────────────────────────── */

/** First hop of x-forwarded-for (set by the proxy), falling back to x-real-ip. */
export function clientIp(request: Request): string | null {
  const forwarded = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return forwarded || request.headers.get('x-real-ip') || null;
}

export function userAgent(request: Request): string | null {
  const ua = request.headers.get('user-agent');
  return ua ? ua.slice(0, 500) : null;
}

/* ── Masking ─────────────────────────────────────────────────────────────── */

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

/** 10-digit Indian mobile, or null when the input isn't one. */
export function normaliseMobile(input: string | null | undefined): string | null {
  const digits = String(input || '').replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s: string | null | undefined) => Boolean(s && EMAIL_RE.test(s.trim()));

/* ── Acceptance record ───────────────────────────────────────────────────── */

/**
 * There is no acceptance form: under Section 18.2 the representative only
 * ticks the declarations and verifies. The School Details on the record are
 * the ones provided before the school admin account was created (Section
 * 13.2(b)), so they are snapshotted from the School row at acceptance time.
 */
export interface SchoolRecord {
  name: string; schoolId: string; address: string | null; city: string | null; district: string | null;
  state: string | null; pincode: string | null; email: string | null; phone: string | null;
}

export const schoolDetailsSnapshot = (s: SchoolRecord) => ({
  schoolName: s.name,
  schoolCode: s.schoolId,
  address: s.address ?? '',
  city: s.city ?? '',
  district: s.district ?? '',
  state: s.state ?? '',
  pincode: s.pincode ?? '',
  officialEmail: s.email ?? '',
  phone: s.phone ?? '',
});

/** Who accepted: the school admin account, deemed authorised (Section 18.3). */
export const ACCEPTED_VIA = 'Authorised Representative (via school admin account)';

/* ── OTP targets ─────────────────────────────────────────────────────────── */

/**
 * Where the verification OTP goes: the school's registered email, or its
 * registered mobile as a fallback. The point of the OTP is to tie the
 * acceptance to the school's known contact.
 */
export function otpTargets(school: { email: string | null; phone: string | null }) {
  const email = isEmail(school.email) ? school.email!.trim().toLowerCase() : null;
  const phone = normaliseMobile(school.phone);
  return { email, phone };
}

/** OTP store key. Includes the email so a changed target invalidates the code. */
export const agreementOtpIdentifier = (schoolId: string, email: string | null) =>
  `school-agreement:${schoolId}:${email ?? ''}`;

/* ── Email rendering ─────────────────────────────────────────────────────── */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function itemsHtml(items: AgreementItem[] | undefined): string {
  if (!items?.length) return '';
  return `<div style="margin:4px 0 0 18px;">${items
    .map(it => `<p style="margin:0 0 4px;">${esc(it.n)} ${it.lead ? `<b>${esc(it.lead)}</b> ` : ''}${esc(it.text)}</p>${itemsHtml(it.items)}`)
    .join('')}</div>`;
}

/** Email-safe HTML of the agreement (inline styles only). */
export function agreementEmailHtml(doc: AgreementDoc = SCHOOL_AGREEMENT): string {
  const parts: string[] = [
    `<p style="margin:0 0 2px;font-size:16px;font-weight:bold;color:#0B2A5C;">${esc(doc.title)}</p>`,
    `<p style="margin:0 0 12px;font-size:12px;color:#5A6B80;">Version ${esc(doc.version)} · Last updated ${esc(doc.lastUpdated)}</p>`,
    `<p style="margin:0 0 10px;"><b>IMPORTANT – PLEASE READ:</b> ${esc(doc.notice)}</p>`,
    ...doc.preamble.map(p => `<p style="margin:0 0 8px;">${esc(p)}</p>`),
  ];
  for (const s of doc.sections) {
    parts.push(`<p style="margin:16px 0 6px;font-size:14px;font-weight:bold;color:#0B2A5C;">${s.n ? `${esc(s.n)}. ` : ''}${esc(s.title)}</p>`);
    for (const c of s.clauses) {
      parts.push(`<p style="margin:0 0 6px;">${c.n ? `<b>${esc(c.n)}</b> ` : ''}${c.lead ? `<b>${esc(c.lead)}</b> ` : ''}${esc(c.text)}</p>${itemsHtml(c.items)}`);
    }
    if (s.table) {
      const cell = 'border:1px solid #E4ECF7;padding:6px 8px;vertical-align:top;font-size:12px;';
      parts.push(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:6px 0 4px;">` +
        `<tr>${s.table.columns.map(h => `<td style="${cell}background:#F4F8FE;font-weight:bold;color:#1552B6;">${esc(h)}</td>`).join('')}</tr>` +
        s.table.rows.map(r => `<tr>${r.map((v, i) => `<td style="${cell}${i === 0 ? 'font-weight:bold;' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('') +
        `</table>`,
      );
    }
  }
  return parts.join('');
}

/** "Monday, 5 October 2026, 3:42:10 pm IST" — every legal timestamp shows IST. */
export function formatIst(date: Date): string {
  return `${date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })} IST`;
}
