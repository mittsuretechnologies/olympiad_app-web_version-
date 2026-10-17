// Categories a school uploads its OWN videos into (not a student's Olympiad
// video). Mirrors the mobile app's SCHOOL_CATEGORY_GROUPS in
// Olympiad_App/Components/screens/app/UploadScreen.js: the general user's
// Talent / Rhymes / Speech groups plus School Activity. Labels are stored as-is
// in Video.category / subCategory, so keep both lists in step.
//
// Client-safe (no server imports): the school portal's upload page uses it.

export const SCHOOL_ACTIVITY_CATEGORY = 'School Activity';

/** The only sub-categories School Activity accepts. */
export const SCHOOL_ACTIVITY_SUBS = [
  'Annual Day',
  'Sports Day',
  'Classroom Activity',
  'Festival Celebration',
  'Competition',
  'Field Trip',
  'Other',
] as const;

export const SCHOOL_CATEGORY_GROUPS: { label: string; subs: readonly string[] }[] = [
  {
    label: 'Talent Performance',
    subs: [
      'Dance', 'Singing', 'Music (Instrument)', 'Acting', 'Yoga', 'Art & Craft', 'Storytelling',
      'Magic', 'Cooking', 'Sports (Any Activity)', 'Poetry (Recitation)', 'Mimic', 'Skipping', 'Hula Hoop',
    ],
  },
  {
    label: 'Rhymes',
    subs: [
      'Twinkle Twinkle Little Star', 'Wheels on the Bus', 'Johny Johny Yes Papa', 'Rain Rain Go Away',
      'Incy Wincy Spider', 'Humpty Dumpty Sat on a Wall', 'Baa Baa Black Sheep', 'Five Little Ducks',
      'Any Other Favourite Rhyme',
    ],
  },
  {
    label: 'Speech & Presentation',
    subs: ['About Myself', 'About My Family', 'About My School', 'My Best Friend', 'My Favourite Toy', 'Any Other'],
  },
  { label: SCHOOL_ACTIVITY_CATEGORY, subs: SCHOOL_ACTIVITY_SUBS },
];

/** Categories a school account may upload into. */
export const SCHOOL_UPLOAD_CATEGORIES = SCHOOL_CATEGORY_GROUPS.map((g) => g.label);

export const isSchoolActivity = (category: unknown) =>
  typeof category === 'string' && category.trim().toLowerCase() === SCHOOL_ACTIVITY_CATEGORY.toLowerCase();
