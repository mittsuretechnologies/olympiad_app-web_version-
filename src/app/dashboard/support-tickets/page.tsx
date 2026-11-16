import { redirect } from 'next/navigation';

// Merged into /dashboard/support (App users tab).
export default function SupportTicketsRedirect() {
  redirect('/dashboard/support?tab=app');
}
