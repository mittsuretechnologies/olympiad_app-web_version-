import { prisma } from '@/lib/prisma';

// Deferred deep link: someone without the app taps a shared-video link, the
// web page sends them to the store, and after installing + signing up the app
// opens that video. Android also gets the id through the Play install
// referrer; iOS has nothing like it, so the page notes the tap here and the
// app's first launch claims it by IP address + platform.

// Long enough to install, sign up and wait for the OTP; short enough that a
// stranger on the same network (a school's Wi-Fi) is unlikely to pick it up.
const MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;
// Old rows are useless after the window; they are pruned now and then.
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

export type SharePlatform = 'android' | 'ios';

export function platformFromUserAgent(ua: string | null | undefined): SharePlatform | null {
  if (!ua) return null;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return null;
}

// Link previews (WhatsApp, Telegram, Facebook...) fetch the page too; those
// aren't people and must not be recorded.
export function isLinkPreviewBot(ua: string | null | undefined): boolean {
  return !ua || /bot|crawler|spider|preview|whatsapp|telegram|facebookexternalhit|facebot|twitterbot|slack|discord|skype|curl|wget|python|go-http|okhttp/i.test(ua);
}

export async function recordShareClick(input: {
  videoId: string; ip: string | null; userAgent: string | null;
}): Promise<void> {
  const platform = platformFromUserAgent(input.userAgent);
  if (!input.ip || !platform || isLinkPreviewBot(input.userAgent)) return;
  try {
    await prisma.shareLinkClick.create({
      data: { videoId: input.videoId, ip: input.ip, platform, userAgent: input.userAgent?.slice(0, 300) ?? null },
    });
    // Occasional cleanup instead of a cron job.
    if (Math.random() < 0.02) {
      await prisma.shareLinkClick.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_MS) } } });
    }
  } catch (e: any) {
    console.error('[deferred-link] record failed:', e?.message || e);
  }
}

/** Newest unclaimed tap from this IP (and platform) inside the window, claimed once. */
export async function claimShareClick(ip: string | null, platform: SharePlatform | null): Promise<string | null> {
  if (!ip || !platform) return null;
  const click = await prisma.shareLinkClick.findFirst({
    where: {
      ip, platform, claimedAt: null,
      createdAt: { gte: new Date(Date.now() - MATCH_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, videoId: true },
  });
  if (!click) return null;
  // Only the first launch to claim it gets it (two phones on one Wi-Fi).
  const { count } = await prisma.shareLinkClick.updateMany({
    where: { id: click.id, claimedAt: null },
    data: { claimedAt: new Date() },
  });
  return count === 1 ? click.videoId : null;
}
