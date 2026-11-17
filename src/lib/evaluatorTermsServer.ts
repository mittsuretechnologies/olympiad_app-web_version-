import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  EVALUATOR_HANDBOOK_PART,
  EVALUATOR_TERMS_DECLARATIONS,
  EVALUATOR_TERMS_INTRO,
  EVALUATOR_TERMS_KEY,
  EVALUATOR_TERMS_PARTS,
  EVALUATOR_TERMS_VERSION,
  type TermsBlock,
} from '@/lib/evaluatorTerms';
import { EVALUATOR_HANDBOOK } from '@/lib/handbook/evaluator-handbook';
import type { HandbookBlock } from '@/lib/handbook/moderator-handbook';

// Server-side helpers for the evaluator acceptance record.

const blockText = (b: TermsBlock): string[] => {
  if (b.kind === 'p') return [b.text];
  if (b.kind === 'ul' || b.kind === 'ol') return b.items;
  return [b.head.join(' | '), ...b.rows.map(r => r.join(' | '))];
};

// Handbook text carries <b>/<i>/<mark>/<a> markup; the record pins the words.
const plain = (t: string) => t.replace(/<\/?(b|i|mark|a)(\s+href="[^"]*")?>/g, '');

const handbookBlockText = (b: HandbookBlock): string[] => {
  if (b.k === 'chapter') return [`${b.n ? `${b.n}. ` : ''}${b.title}`];
  if (b.k === 'heading') return [b.text];
  if (b.k === 'p') return [plain(b.text)];
  if (b.k === 'table') return [b.head.join(' | '), ...b.rows.map(r => r.map(plain).join(' | '))];
  return [b.title, ...b.lines.map(plain)];
};

/** Canonical plain text of exactly what the evaluator is shown (Parts A, B and C). */
export function evaluatorTermsPlainText(): string {
  const lines: string[] = [EVALUATOR_TERMS_INTRO];
  for (const part of EVALUATOR_TERMS_PARTS) {
    lines.push(part.heading, part.intro);
    for (const sec of part.sections) {
      lines.push(sec.title);
      for (const b of sec.blocks) lines.push(...blockText(b));
    }
  }
  lines.push(
    EVALUATOR_HANDBOOK_PART.heading, EVALUATOR_HANDBOOK_PART.intro,
    EVALUATOR_HANDBOOK.title, `Version ${EVALUATOR_HANDBOOK.version}`,
  );
  for (const b of EVALUATOR_HANDBOOK.blocks) lines.push(...handbookBlockText(b));
  lines.push('Declarations', ...EVALUATOR_TERMS_DECLARATIONS);
  return lines.join('\n');
}

let cachedHash: string | null = null;

/** SHA-256 of the canonical text — pins the exact wording that was accepted. */
export function evaluatorTermsHash(): string {
  if (!cachedHash) cachedHash = crypto.createHash('sha256').update(evaluatorTermsPlainText(), 'utf8').digest('hex');
  return cachedHash;
}

/** The evaluator's unrevoked acceptance of the CURRENT version, or null. */
export function currentEvaluatorAcceptance(evaluatorId: string) {
  return prisma.agreementAcceptance.findFirst({
    where: {
      role: 'EVALUATOR', actorId: evaluatorId,
      documentKey: EVALUATOR_TERMS_KEY, documentVersion: EVALUATOR_TERMS_VERSION,
      revokedAt: null,
    },
    orderBy: { acceptedAt: 'desc' },
    select: { id: true, acceptedAt: true },
  });
}
