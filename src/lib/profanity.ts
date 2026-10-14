import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';
import hiWords from 'naughty-words/hi.json';

/**
 * Abusive-text check for usernames, school names, captions and similar.
 *
 * Two detectors, either one flagging the text blocks it:
 *   1. `obscenity` - English, with disguised spellings (f*ck, f.u.c.k, sh1t,
 *      repeated letters) and whole-word matching, so names like "Assam" or
 *      "Classic" are not caught.
 *   2. The `naughty-words` Hindi list, which is Hindi written in English
 *      letters (Hinglish), plus a few Devanagari and spelling variants below.
 *      It is matched on a normalized form of the text.
 *
 * Neither is perfect: new spellings will slip through and a rare innocent name
 * may be caught. Treat it as a first line of defence next to reporting.
 */

const english = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

// Spelling variants and Devanagari the package list does not carry.
const EXTRA_WORDS = [
  'madarchod', 'maderchod', 'madrchod', 'bhenchod', 'behnchod', 'bhosdike',
  'bhosdi', 'bhosada', 'chutiya', 'chutiye', 'gaandu', 'randi', 'lauda',
  'लौड़ा', 'मादरचोद', 'बहनचोद', 'भोसड़ी', 'चूतिया', 'गांडू', 'रंडी', 'हरामी', 'कमीना',
];

const LEET: Record<string, string> = {
  '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e',
  '$': 's', '5': 's', '7': 't', '8': 'b',
};

// Normalizes to lowercase letters with look-alike symbols replaced and every
// run of a repeated letter collapsed (so "chuuutiya" and "chutiya" match).
function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[@40!|13$578]/g, ch => LEET[ch] ?? ch)
    .replace(/(.)\1+/gu, '$1');
}

const squashed = (s: string) => s.replace(/[^a-zऀ-ॿ]+/g, '');
const tokens   = (s: string) => s.split(/[^a-zऀ-ॿ]+/).filter(Boolean);

// Words of six or more letters are matched anywhere inside a name (so
// "xxmadarchodxx" is caught); shorter ones only as a whole word, which avoids
// flagging names that merely contain them.
const SUBSTRING_MIN = 6;
const hindiWords = [...new Set([...(hiWords as string[]), ...EXTRA_WORDS]
  .map(w => squashed(normalize(w)))
  .filter(w => w.length >= 3))];
const hindiSubstring = hindiWords.filter(w => w.length >= SUBSTRING_MIN);
const hindiWhole     = new Set(hindiWords.filter(w => w.length < SUBSTRING_MIN));

// "f.u.c.k" or "s h i t": joins runs of single characters back into one word so
// the English check sees them.
function joinedLetterRuns(text: string): string[] {
  const runs: string[] = [];
  let run = '';
  for (const part of text.split(/[\s._*-]+/u)) {
    if ([...part].length === 1) { run += part; continue; }
    if (run.length >= 3) runs.push(run);
    run = '';
  }
  if (run.length >= 3) runs.push(run);
  return runs;
}

export function containsAbuse(text: string | null | undefined): boolean {
  if (!text) return false;
  if (english.hasMatch(text)) return true;
  if (joinedLetterRuns(text).some(r => english.hasMatch(r))) return true;

  const norm = normalize(text);
  const flat = squashed(norm);
  if (hindiSubstring.some(w => flat.includes(w))) return true;
  return tokens(norm).some(t => hindiWhole.has(t));
}

// Tells the user which field was refused, so they know what to fix.
export const ABUSIVE_MESSAGES = {
  caption:  'Your caption contains words that are not allowed. Please edit it and try again.',
  hashtag:  'This hashtag contains words that are not allowed. Please remove it.',
  hashtags: 'One of your hashtags contains words that are not allowed. Please remove it.',
  username: 'This username contains words that are not allowed. Please choose a different one.',
  name:     'The name you entered contains words that are not allowed. Please use a different name.',
} as const;

/** The refusal message for a caption + hashtags pair, or null when both are fine. */
export function captionTagsAbuseMessage(caption: unknown, tags: unknown): string | null {
  if (typeof caption === 'string' && containsAbuse(caption)) return ABUSIVE_MESSAGES.caption;
  if (typeof tags === 'string' && containsAbuse(tags)) return ABUSIVE_MESSAGES.hashtags;
  return null;
}
