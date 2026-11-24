import { erpCover } from '@/lib/mittTvErp';

export const dynamic = 'force-dynamic';

// GET /api/app/mitttv/erp/cover/:bookId?shape=wide|tall — an ERP book cover made
// small for the app (the originals are multi-MB PNGs). No login: images load
// without the app's token, and the covers are public on the ERP server too.
// Kept in server memory only; the phone caches it for a day.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const shape = new URL(request.url).searchParams.get('shape') === 'tall' ? 'tall' : 'wide';
    const img = await erpCover(id, shape);
    if (!img) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(img), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(img.length),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (e: any) {
    console.error('mitttv erp cover error:', e?.message);
    return new Response('Cover unavailable', { status: 502 });
  }
}
