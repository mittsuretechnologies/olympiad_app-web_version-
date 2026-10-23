import crypto from 'crypto';
import {
  EVALUATOR_TERMS_DECLARATIONS,
  EVALUATOR_TERMS_INTRO,
  EVALUATOR_TERMS_PARTS,
  type TermsBlock,
} from '@/lib/evaluatorTerms';

// Server-side helpers for the evaluator acceptance record.

const blockText = (b: TermsBlock): string[] => {
  if (b.kind === 'p') return [b.text];
  if (b.kind === 'ul' || b.kind === 'ol') return b.items;
  return [b.head.join(' | '), ...b.rows.map(r => r.join(' | '))];
};

/** Canonical plain text of exactly what the evaluator is shown. */
export function evaluatorTermsPlainText(): string {
  const lines: string[] = [EVALUATOR_TERMS_INTRO];
  for (const part of EVALUATOR_TERMS_PARTS) {
    lines.push(part.heading, part.intro);
    for (const sec of part.sections) {
      lines.push(sec.title);
      for (const b of sec.blocks) lines.push(...blockText(b));
    }
  }
  lines.push('Declarations', ...EVALUATOR_TERMS_DECLARATIONS);
  return lines.join('\n');
}

let cachedHash: string | null = null;

/** SHA-256 of the canonical text — pins the exact wording that was accepted. */
export function evaluatorTermsHash(): string {
  if (!cachedHash) cachedHash = crypto.createHash('sha256').update(evaluatorTermsPlainText(), 'utf8').digest('hex');
  return cachedHash;
}
