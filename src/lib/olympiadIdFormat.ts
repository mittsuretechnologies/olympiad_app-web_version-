// Olympiad ID format — always 11 characters:
//   6-digit CRM number + 1-char class code + 4-digit sequence
//   e.g. CRM S-112535, Nursery, first ID → 112535N0001
//
// CRM IDs are "S-" + up to 6 digits, or bare digits (S-738, S-4319, S-112535,
// 72974). The prefix is just the digits, left-padded to 6, so nothing is cut
// off. The old rule took the first 6 chars *including the S*, which gave 9–10
// char IDs for short CRMs and one prefix to two schools with 6-digit ones
// (S-156037 and S-156038 → S15603). Because the prefix is the CRM number, no
// two schools may share one — enforced wherever a CRM ID is saved (see
// lib/schoolCrm).
//
// IDs issued before this format are already with schools; they stay valid and
// are never rewritten. The sequence runs continuously across the whole school
// (per prefix), while the class char changes per class.

import { CLASSES } from '@/lib/classes';

export const OLYMPIAD_CODE_LENGTH = 11;
export const OLYMPIAD_MAX_SEQUENCE = 9999;
const CRM_ID_RE = /^(S-?)?\d{1,6}$/i;
const OLYMPIAD_CODE_RE = /^\d{6}[A-Z]\d{4}$/;

const CLASS_CODES = new Set(CLASSES.map((c) => c.code));

export const CRM_ID_FORMAT_HINT = 'S- followed by up to 6 digits (e.g. S-112535), or up to 6 digits only';

/** "S-112535" → "112535", "S-4319" → "004319"; null if not a valid CRM ID. */
export function olympiadPrefixForCrm(crmId: string): string | null {
  const crm = (crmId || '').trim();
  if (!CRM_ID_RE.test(crm)) return null;
  return crm.replace(/\D/g, '').padStart(6, '0');
}

/** Builds one ID; throws if the result would not be a valid 11-char code. */
export function buildOlympiadCode(prefix: string, classCode: string, sequence: number): string {
  if (!CLASS_CODES.has(classCode)) throw new Error(`Invalid class code: ${classCode}`);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > OLYMPIAD_MAX_SEQUENCE) {
    throw new Error(`Sequence out of range: ${sequence}`);
  }
  const code = `${prefix}${classCode}${String(sequence).padStart(4, '0')}`;
  if (!isValidOlympiadCode(code)) throw new Error(`Invalid Olympiad ID: ${code}`);
  return code;
}

export function isValidOlympiadCode(code: string): boolean {
  return code.length === OLYMPIAD_CODE_LENGTH && OLYMPIAD_CODE_RE.test(code);
}
