// One place for the public "share a video" link settings.
// Link: https://<SHARE_BASE>/v/<videoId>. Phones with the app installed open it
// in the app (Android App Links / iOS Universal Links); everyone else gets the
// web page in app/v/[id]/page.tsx.
export const ANDROID_PACKAGE = 'com.mittmee.app';
export const IOS_BUNDLE_ID = 'com.mittmee.app';

export function shareBaseUrl(): string {
  return (process.env.PUBLIC_SHARE_BASE_URL || 'https://admin.mittmee.com').replace(/\/+$/, '');
}

// Play Store link carrying the video id through the install (Play Install Referrer).
export function playStoreUrl(videoId: string): string {
  const referrer = encodeURIComponent(`mittmee_video=${videoId}`);
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${referrer}`;
}

const UUID_TAIL = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Link looks: /v/<description-slug>-<videoId>. Same rules as the app's slugify.
export function slugify(text?: string | null): string {
  const s = String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return s || 'video';
}

export const videoPath = (id: string, caption?: string | null) => `/v/${slugify(caption)}-${id}`;

// The route segment is "<slug>-<id>" (or just "<id>"); the video is found by the id at the end.
export function videoIdFromSegment(segment: string): string | null {
  const m = decodeURIComponent(segment).match(UUID_TAIL);
  return m ? m[1].toLowerCase() : null;
}
