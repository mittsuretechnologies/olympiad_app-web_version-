// Video length, caption and hashtag rules, matching the mobile app's upload screen
// (Olympiad_App/Components/screens/app/UploadScreen.js): a caption is at most
// 2,200 characters (its TextInput maxLength), and at most 30 custom hashtags,
// each cleaned the way the app's addTag does. Used wherever the web lets
// someone write either (school upload, moderation edits).
//
// Client-safe (no server imports).

export const MAX_CAPTION_LENGTH = 2200;
/** The app's video length limit (UploadScreen MAX_DURATION_SECONDS, enforced
 *  again by /api/app/upload-video/finalize). */
export const MAX_VIDEO_SECONDS = 120;
export const VIDEO_TOO_LONG_MESSAGE = 'Videos must be 2 minutes or shorter. Please choose a shorter video or trim it first.';
export const MAX_CUSTOM_TAGS = 30;

/** "#Madhya Pradesh" → "MadhyaPradesh": no leading #, no spaces, no commas
 *  (tags are stored comma-joined). Empty string when nothing is left. */
export function cleanHashtag(raw: string): string {
  return raw.trim().replace(/^#+/, '').replace(/[\s,]+/g, '');
}
