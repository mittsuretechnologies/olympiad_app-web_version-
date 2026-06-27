// Category A — Video 1 Submission (all grades)
export const OLYMPIAD_CAT_A_SUBS = [
  'Dance',
  'Singing',
  'Music (Instrument)',
  'Acting',
  'Yoga',
  'Art & Craft',
  'Storytelling',
  'Magic',
  'Cooking',
  'Sports (Any Activity)',
  'Poetry (Recitation)',
  'Any Other Special Talent',
];

// Category B — Video 2 Submission
// Nursery & LKG students: rhymes
export const OLYMPIAD_CAT_B_NURSERY_LKG_SUBS = [
  'Twinkle Twinkle Little Star',
  'Wheels on the Bus',
  'Johny Johny Yes Papa',
  'Rain Rain Go Away',
  'Incy Wincy Spider',
  'Humpty Dumpty Sat on a Wall',
  'Baa Baa Black Sheep',
  'Five Little Ducks',
  'Any Other Favourite Rhyme',
];

// UKG students: speech / talent presentation
export const OLYMPIAD_CAT_B_UKG_SUBS = [
  'About Yourself',
  'About Your Family',
  'About Your School',
  'Any Topic',
];

// Combined Cat B (all subs) — used for slot detection regardless of grade
export const OLYMPIAD_CAT_B_SUBS = [
  ...OLYMPIAD_CAT_B_NURSERY_LKG_SUBS,
  ...OLYMPIAD_CAT_B_UKG_SUBS,
];

// Class codes that map to Nursery / LKG — anything not in this set is treated as UKG
export const NURSERY_LKG_CLASS_CODES = ['nursery', 'lkg', 'pre-nursery', 'prenursery', 'pre_nursery', 'jr.kg', 'jrkg', 'jr kg', 'n', 'k'];

// Prefix letters (last char of the school-prefix portion) that map to Nursery/LKG
// e.g. "976586N0001" → prefix letter = 'N' → Nursery
//      "976586K0005" → prefix letter = 'K' → LKG
export const NURSERY_LKG_PREFIX_LETTERS = ['n', 'k'];

export function isNurseryOrLkg(classCode: string | null | undefined, olympiadId?: string | null): boolean {
  // 1. Try classCode first (explicit, set by admin)
  if (classCode) {
    return NURSERY_LKG_CLASS_CODES.includes(classCode.toLowerCase().trim());
  }
  // 2. Fall back to Olympiad ID prefix letter (last alpha char before the digits)
  if (olympiadId) {
    const match = olympiadId.match(/([A-Za-z]+)\d+$/);
    if (match) {
      const prefixLetter = match[1].slice(-1).toLowerCase(); // last letter of the prefix portion
      return NURSERY_LKG_PREFIX_LETTERS.includes(prefixLetter);
    }
  }
  return false;
}

export const OLYMPIAD_CAT_A_LABEL = 'Talent Performance';
export const OLYMPIAD_CAT_B_LABEL = 'Rhymes / Speech';
