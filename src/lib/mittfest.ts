// A video reaches the home screen's MittFest row two ways: the uploader ticks
// the "Is this video for MittFest?" checkbox, or they add a #mittfest hashtag.
// Both set the same Video.isMittfest flag at creation time, so the feed query
// stays a plain `isMittfest: true` filter instead of also pattern-matching the
// comma-joined tags string on every read.
//
// The app strips a leading '#' before sending (see addTag in UploadScreen), but
// the web upload forms and any older client may not, so the '#' is stripped
// here too. Matching is case-insensitive — tags are free text.
export const MITTFEST_TAG = 'mittfest';

export function hasMittfestTag(tags: string[] | string | null | undefined): boolean {
  if (!tags) return false;
  const list = Array.isArray(tags)
    ? tags
    : tags.split(',').map(t => t.trim()).filter(Boolean);
  return list.some(t => t.replace(/^#+/, '').toLowerCase() === MITTFEST_TAG);
}
