import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { visibilityWhere } from '@/lib/videoVisibility';
import { getAppVersionSettings } from '@/lib/appVersion';
import { headers } from 'next/headers';
import { ANDROID_PACKAGE, playStoreUrl, shareBaseUrl, videoIdFromSegment, videoPath } from '@/lib/shareLink';
import { isLinkPreviewBot, platformFromUserAgent, recordShareClick } from '@/lib/deferredLink';
import AutoOpen from './AutoOpen';

export const dynamic = 'force-dynamic';

// Landing page for a shared video link (people without the app, and the
// WhatsApp / Telegram link preview). Same anonymous visibility rules as the feed.
async function loadVideo(segment: string) {
  const id = videoIdFromSegment(segment);
  if (!id) return null;
  const vis = await visibilityWhere(null);
  const video = await prisma.video.findFirst({
    where: { id, status: 'APPROVED', isPublic: true, ...vis },
    select: { id: true, caption: true, thumbnailUrl: true },
  });
  if (video) return video;
  // SuperAdmin Learning / Parenting videos live in their own table.
  const curated = await prisma.homeSectionVideo.findFirst({
    where: { id, isActive: true },
    select: { id: true, title: true, description: true, thumbnailUrl: true },
  });
  return curated
    ? { id: curated.id, caption: curated.title || curated.description, thumbnailUrl: curated.thumbnailUrl }
    : null;
}

function absolute(url?: string | null) {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : `${shareBaseUrl()}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const video = await loadVideo(id).catch(() => null);
  const title = video?.caption?.trim() || 'Watch this video on Mittmee';
  const image = absolute(video?.thumbnailUrl);
  return {
    title: `${title} · Mittmee`,
    description: 'Watch this video on Mittmee.',
    openGraph: { title, description: 'Watch this video on Mittmee.', url: `${shareBaseUrl()}${video ? videoPath(video.id, video.caption) : `/v/${id}`}`, images: image ? [image] : undefined, type: 'website' },
    twitter: { card: image ? 'summary_large_image' : 'summary', title },
  };
}

export default async function SharedVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [video, settings] = await Promise.all([
    loadVideo(id).catch(() => null),
    getAppVersionSettings().catch(() => null),
  ]);
  const thumb = absolute(video?.thumbnailUrl);
  const iosUrl = settings?.iosStoreUrl || '';

  // Who opened the link: a phone without the app (send it on to the app or the
  // store, and note the tap for after the install) or a link-preview bot /
  // desktop (just show the page).
  const h = await headers();
  const ua = h.get('user-agent');
  const platform = isLinkPreviewBot(ua) ? null : platformFromUserAgent(ua);
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || null;
  if (video && platform) await recordShareClick({ videoId: video.id, ip, userAgent: ua });
  const store = playStoreUrl(video?.id ?? id);
  const androidIntent = video && platform === 'android'
    ? `intent://v/${video.id}#Intent;scheme=mittmee;package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(store)};end`
    : null;
  const iosStore = video && platform === 'ios' && iosUrl ? iosUrl : null;
  const btn: React.CSSProperties = {
    display: 'block', padding: '14px 18px', borderRadius: 12, fontWeight: 700,
    textAlign: 'center', textDecoration: 'none', fontSize: 15,
  };
  return (
    <main style={{ minHeight: '100vh', background: '#FBF6EE', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <AutoOpen androidIntent={androidIntent} iosStore={iosStore} />
      <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 8px 30px rgba(36,30,24,0.10)', textAlign: 'center', color: '#241E18' }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" style={{ width: '100%', borderRadius: 14, aspectRatio: '9 / 12', objectFit: 'cover', marginBottom: 14 }} />
        ) : null}
        <h1 style={{ fontSize: 18, margin: '0 0 6px' }}>
          {video ? (video.caption?.trim() || 'A video on Mittmee') : 'This video is not available'}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(36,30,24,0.65)', margin: '0 0 18px' }}>
          {video ? 'Get the Mittmee app, sign in or sign up, and watch it there.' : 'It may have been removed or made private.'}
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {video ? <a href={`mittmee://v/${video.id}`} style={{ ...btn, background: '#3E82E0', color: '#fff' }}>Open in Mittmee app</a> : null}
          <a href={store} style={{ ...btn, background: '#241E18', color: '#fff' }}>Get it on Google Play</a>
          {iosUrl ? <a href={iosUrl} style={{ ...btn, background: '#241E18', color: '#fff' }}>Download on the App Store</a> : null}
        </div>
      </div>
    </main>
  );
}
