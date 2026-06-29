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

// Cat B is class-dependent: Rhymes for PG/Nursery/LKG, Speech/Talent for UKG.
export const OLYMPIAD_CAT_B_RHYMES_SUBS = [
  'Twinkle Twinkle Little Star',
  'Wheels on the Bus',
  'Johny Johny Yes Papa',
  'Rain Rain Go Away',
  'Incy Wincy Spider',
  'Humpty Dumpty Sat on a Wall',
  'Baa Baa Black Sheep',
  'Five Little Ducks',
  'Any other favourite rhyme',
];

export const OLYMPIAD_CAT_B_SPEECH_SUBS = [
  'About Yourself',
  'About Your Family',
  'About Your School',
  'Any Topic',
];

// classCode values from src/lib/classes.ts — UKG (U) gets the Speech/Talent list,
// every other class (PG/Nursery/LKG/etc.) gets the Rhymes list.
export function getCatBSubs(classCode: string | null | undefined): string[] {
  return classCode === 'U' ? OLYMPIAD_CAT_B_SPEECH_SUBS : OLYMPIAD_CAT_B_RHYMES_SUBS;
}

// Combined list of every possible Cat B subcategory — used for classification
// checks (e.g. "is this video's subCategory a Cat B one?") regardless of class.
export const OLYMPIAD_CAT_B_SUBS = [...OLYMPIAD_CAT_B_RHYMES_SUBS, ...OLYMPIAD_CAT_B_SPEECH_SUBS];

export const OLYMPIAD_CAT_A_LABEL = 'Performing Art, Dance & Music';
export const OLYMPIAD_CAT_B_LABEL = 'Rhymes / Speech & Talent Presentation';
