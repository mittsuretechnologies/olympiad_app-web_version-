import { redirect } from 'next/navigation';

// Merged into /dashboard/support. Kept so links in already-sent notification
// emails (?ticket=<id>) still open the request.
export default async function SchoolSupportRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ticket } = await searchParams;
  const t = typeof ticket === 'string' ? ticket : '';
  redirect(`/dashboard/support?tab=schools${t ? `&ticket=${encodeURIComponent(t)}` : ''}`);
}
