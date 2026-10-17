// The option lists below match the mobile app's upload screen exactly
// (Olympiad_App/Components/screens/app/UploadScreen.js: OLY_CAT_A_SUBS,
// OLY_CAT_B_NURSERY_SUBS, OLY_CAT_B_UKG_SUBS). The selected option's label is
// stored as Video.subCategory as it is, so keep the spelling identical.
//
// *_OPTIONS are what a picker shows; *_SUBS also hold retired spellings so
// older records still classify (slot, badge, filters).

// Category A — Video 1 Submission (all grades)
export const OLYMPIAD_CAT_A_OPTIONS = [
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
  'Mimic',
  'Skipping',
  'Hula Hoop',
  'Other',
];

export const OLYMPIAD_CAT_A_SUBS = [
  ...OLYMPIAD_CAT_A_OPTIONS,
  // Retired label — the app's "Any Other Special Talent" option was renamed to
  // "Other" (and its free-text field removed). Kept here so videos uploaded
  // before that change still resolve to Cat A: this array is what decides a
  // video's A/B slot (resolveSlot) and its category badge.
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
  'Any Other Favourite Rhyme',
];

export const OLYMPIAD_CAT_B_SPEECH_SUBS = [
  'About Myself',
  'About My Family',
  'About My School',
  'My Best Friend',
  'My Favourite Toy',
  'Any Other',
];

// classCode values from src/lib/classes.ts — UKG (U) gets the Speech/Talent list,
// every other class (PG/Nursery/LKG/etc.) gets the Rhymes list.
export function getCatBSubs(classCode: string | null | undefined): string[] {
  return classCode === 'U' ? OLYMPIAD_CAT_B_SPEECH_SUBS : OLYMPIAD_CAT_B_RHYMES_SUBS;
}

// Every Cat B option regardless of class, for pickers that aren't tied to one
// student (e.g. the moderation filter).
export const OLYMPIAD_CAT_B_OPTIONS = [...OLYMPIAD_CAT_B_RHYMES_SUBS, ...OLYMPIAD_CAT_B_SPEECH_SUBS];

// Combined list of every possible Cat B subcategory — used for classification
// checks (e.g. "is this video's subCategory a Cat B one?") regardless of class.
export const OLYMPIAD_CAT_B_SUBS = [
  ...OLYMPIAD_CAT_B_OPTIONS,
  // Retired spelling: the web portal saved this rhyme option in lower case
  // while the app saves "Any Other Favourite Rhyme". Kept so those records
  // still classify as Cat B.
  'Any other favourite rhyme',
];

export const OLYMPIAD_CAT_A_LABEL = 'Talent Performance';
export const OLYMPIAD_CAT_B_LABEL = 'Rhymes / Speech';

// Maps the internal stored category value ('Cat A' / 'Cat B') — or an
// already-friendly label from older records — to the current display name.
export function getCategoryDisplayLabel(category: string): string {
  if (category === 'Cat A') return OLYMPIAD_CAT_A_LABEL;
  if (category === 'Cat B') return OLYMPIAD_CAT_B_LABEL;
  return category;
}
