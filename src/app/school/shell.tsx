'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LogOut, Contact, LayoutDashboard, Users, School, UploadCloud, Clapperboard, Menu, X,
  ClipboardList, UserCheck, type LucideIcon,
} from 'lucide-react';
import { initialsOf } from './ui';
import { jakarta } from './fonts';

/**
 * School Panel frame: a light sidebar grouped by task, a slim top bar with
 * breadcrumb, and the page canvas. Presentational only — session and agreement
 * handling stay in the layout.
 */

type NavItem = { name: string; href: string; icon: LucideIcon };

// Grouped by what the administrator is doing, so the sidebar reads as a map of
// the work rather than a flat list of pages.
const NAV: { label?: string; items: NavItem[] }[] = [
  { items: [{ name: 'Dashboard', href: '/school', icon: LayoutDashboard }] },
  {
    label: 'Students',
    items: [
      { name: 'Olympiad IDs', href: '/school/olympiad-ids', icon: Contact },
      { name: 'My Students', href: '/school/registered-students', icon: Users },
      { name: 'Student Requests', href: '/school/student-requests', icon: UserCheck },
      { name: 'Student Report', href: '/school/reports', icon: ClipboardList },
    ],
  },
  {
    label: 'Videos',
    items: [
      { name: 'Student Videos', href: '/school/student-videos', icon: Clapperboard },
      { name: 'Upload Video', href: '/school/upload-video', icon: UploadCloud },
    ],
  },
  { label: 'School', items: [{ name: 'School Profile', href: '/school/profile', icon: School }] },
];

const isActive = (pathname: string, href: string) =>
  href === '/school' ? pathname === '/school' : pathname.startsWith(href);

function Wordmark({ size = 16 }: { size?: number }) {
  return (
    <span className="font-bold tracking-[-0.02em]" style={{ fontSize: size }}>
      <span className="text-[#1559C7]">mitt</span><span className="text-[#2E9E46]">mee</span>
    </span>
  );
}

export default function SchoolShell({
  user,
  onLogout,
  children,
}: {
  user: { name?: string; schoolId?: string } | null;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Mobile drawer: close on navigation, and lock the page behind it.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const initials = initialsOf(user?.name || 'School');

  return (
    // The panel's own typeface: overriding --font-sans here makes every
    // `font-sans` utility inside the panel resolve to it.
    <div
      className={`${jakarta.variable} min-h-screen bg-[#F4F5F7] font-sans text-[#0F1B2D] antialiased`}
      style={{ ['--font-sans' as string]: 'var(--font-jakarta), var(--font-inter), system-ui, sans-serif' }}
    >
      {/* Mobile top bar */}
      <header className="lg:hidden fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-[#E6E8EC] bg-white/90 px-4 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="-ml-2 cursor-pointer rounded-lg p-2 text-[#2A3446] transition-colors hover:bg-[#F4F5F7] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Image src="/mittmee-icon.jpeg" alt="" width={26} height={26} className="rounded-md" priority />
          <Wordmark size={15} />
        </div>
        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1B33] text-[11px] font-semibold text-white">
          {initials}
        </span>
      </header>

      {/* Drawer backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-[#0B1B33]/40 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Sidebar */}
      <aside
        className={`fixed top-0 z-50 flex h-screen w-[256px] max-w-[85vw] flex-col border-r border-[#E6E8EC] bg-white transition-transform duration-200 ease-out lg:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3.5 z-10 cursor-pointer rounded-lg p-2 text-[#677285] transition-colors hover:bg-[#F4F5F7] hover:text-[#0F1B2D] lg:hidden"
        >
          <X size={18} />
        </button>

        {/* Brand */}
        <div className="flex h-16 flex-shrink-0 items-center gap-2.5 px-5">
          <Image src="/mittmee-icon.jpeg" alt="" width={32} height={32} className="rounded-lg" priority />
          <div className="min-w-0 leading-none">
            <Wordmark />
            <p className="mt-1 text-[11px] font-medium text-[#8A93A3]">School Panel</p>
          </div>
        </div>

        {/* School identity */}
        <div className="mx-3 flex items-center gap-2.5 rounded-xl border border-[#E6E8EC] bg-[#F8F9FB] px-3 py-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#0B1B33] text-[12px] font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-[#0F1B2D]" title={user?.name}>{user?.name || 'School'}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-[#677285]">{user?.schoolId}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="School Panel">
          {NAV.map((group, gi) => (
            <div key={group.label ?? gi} className={gi ? 'mt-5' : ''}>
              {group.label && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A93A3]">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25 ${
                        active
                          ? 'bg-[#EEF3FC] font-semibold text-[#1559C7]'
                          : 'font-medium text-[#475265] hover:bg-[#F4F5F7] hover:text-[#0F1B2D]'
                      }`}
                    >
                      {active && <span aria-hidden="true" className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#1559C7]" />}
                      <Icon size={17} strokeWidth={active ? 2 : 1.75} className="flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Log out */}
        <div className="flex-shrink-0 border-t border-[#EEF0F3] p-3">
          <button
            onClick={onLogout}
            className="flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium text-[#475265] transition-colors hover:bg-[#FEF2F2] hover:text-[#B42323] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25"
          >
            <LogOut size={17} strokeWidth={1.75} className="flex-shrink-0" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="min-h-screen pt-14 lg:ml-[256px] lg:pt-0">
        <main className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-5">{children}</main>
      </div>
    </div>
  );
}
