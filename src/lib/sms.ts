/**
 * SMS delivery via the Satzilio / bulksmsserviceproviders HTTP gateway.
 *
 * India's DLT rules mean we can't send arbitrary text: every message must match
 * a template pre-approved under our Principal Entity ID, and is sent under an
 * approved 6-character sender header. The operator silently drops anything whose
 * text doesn't match the registered template character-for-character.
 *
 * Every value here — endpoint, credentials, sender, entity, template ids and the
 * approved wording itself — comes from .env with no hardcoded fallback, so a
 * re-approved template or a change of provider is a config edit, not a release.
 */

const SMS_API_URL = process.env.SMS_API_URL;
const SMS_AUTH_KEY = process.env.SMS_AUTH_KEY;
const SMS_USER = process.env.SMS_USER;
const SMS_PASSWORD = process.env.SMS_PASSWORD;
const SMS_SENDER_ID = process.env.SMS_SENDER_ID;
const SMS_ENTITY_ID = process.env.SMS_ENTITY_ID;
// "TR" = transactional, the route OTPs must use; promotional routes are subject
// to DND filtering and would drop OTPs for registered numbers.
const SMS_ROUTE = process.env.SMS_ROUTE || 'TR';
const SMS_CAMPAIGN_NAME = process.env.SMS_CAMPAIGN_NAME || 'mittmee-otp';

const SEND_TIMEOUT_MS = 10_000;

export type OtpPurpose = 'signup' | 'reset';

/**
 * Approved DLT templates, by purpose. Each body is the registered text with
 * {otp} standing in for the template's {#var#} placeholder — copy it out of the
 * DLT panel verbatim, including punctuation and the trailing sender name.
 */
const TEMPLATES: Record<OtpPurpose, { id?: string; body?: string }> = {
  signup: {
    id: process.env.SMS_TEMPLATE_SIGNUP,
    body: process.env.SMS_TEMPLATE_SIGNUP_BODY,
  },
  reset: {
    id: process.env.SMS_TEMPLATE_RESET,
    body: process.env.SMS_TEMPLATE_RESET_BODY,
  },
};

/**
 * A body whose placeholder is missing would send the approved text without the
 * OTP in it — a message that costs money, passes DLT, and is useless to the
 * user — so the placeholder is required rather than optional.
 */
function renderTemplate(purpose: OtpPurpose, otp: string): { id: string; text: string } {
  const { id, body } = TEMPLATES[purpose];

  if (!id) throw new Error(`Missing DLT template id for "${purpose}" OTPs (set it in .env)`);
  if (!body) throw new Error(`Missing DLT template body for "${purpose}" OTPs (set it in .env)`);
  if (!body.includes('{otp}')) {
    throw new Error(`DLT template body for "${purpose}" OTPs has no {otp} placeholder`);
  }

  return { id, text: body.replaceAll('{otp}', otp) };
}

/**
 * The gateway accepts either an auth key or a username/password pair; the key
 * is preferred when both are present.
 */
function hasCredentials(): boolean {
  return Boolean(SMS_AUTH_KEY || (SMS_USER && SMS_PASSWORD));
}

export function isSmsConfigured(): boolean {
  return Boolean(SMS_API_URL && SMS_SENDER_ID && hasCredentials());
}

/**
 * Gateways reject bare 10-digit numbers, so normalise to the 91XXXXXXXXXX form
 * they expect. Accepts input with spaces, +91, or a leading 0.
 */
function normaliseMobile(input: string): string {
  const digits = String(input).replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;

  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new Error(`Not a valid Indian mobile number: ${input}`);
  }
  return `91${local}`;
}

/**
 * The gateway's payload shape is undocumented and unforgiving: the text,
 * template id and coding go *inside* a nested `message` object, and any flat
 * arrangement is refused with "message perameter json invalid" regardless of
 * how the rest of the request looks. Shape verified against the working
 * MittsureERP integration and a live send.
 */
function buildPayload(mobile: string, text: string, templateId: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    auth_key: SMS_AUTH_KEY,
    receivers: mobile,
    sender: SMS_SENDER_ID,
    route: SMS_ROUTE,
    campaign_name: SMS_CAMPAIGN_NAME,
    message: {
      msgdata: text,
      Template_ID: templateId,
      coding: '1',
    },
  };

  // The entity is registered against the account, so the gateway derives it and
  // only needs it sent when explicitly configured.
  if (SMS_ENTITY_ID) payload.entity_id = SMS_ENTITY_ID;
  return payload;
}

/**
 * The gateway answers HTTP 200 for both outcomes and reports the real result in
 * the body — a rejection arrives as {"status":403,"message":"..."} — so success
 * is asserted positively rather than inferred from the HTTP status. It is also
 * inconsistent about which field carries the verdict, hence both checks.
 */
function assertGatewayAccepted(body: string): void {
  let parsed: { status?: unknown; message?: unknown };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`SMS gateway returned an unreadable response: ${body.slice(0, 200)}`);
  }

  const accepted =
    String(parsed.status).toLowerCase() === 'success' ||
    String(parsed.message ?? '').toLowerCase().includes('successfully');

  if (!accepted) {
    throw new Error(`SMS gateway rejected the message: ${body.slice(0, 200)}`);
  }
}

/**
 * Sends an OTP over SMS. Throws when the gateway is unconfigured, unreachable,
 * or rejects the message, so callers can fall back the way they do for email.
 */
export async function sendOtpSms(mobile: string, otp: string, purpose: OtpPurpose): Promise<void> {
  if (!isSmsConfigured()) {
    throw new Error(
      'SMS is not configured (set SMS_API_URL, SMS_SENDER_ID and SMS_AUTH_KEY — ' +
        'or SMS_USER and SMS_PASSWORD — in .env)'
    );
  }

  const { id, text } = renderTemplate(purpose, otp);
  const to = normaliseMobile(mobile);
  const payload = buildPayload(to, text, id);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(SMS_API_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`SMS gateway timed out after ${SEND_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const body = (await response.text()).trim();
  assertGatewayAccepted(body);
}
