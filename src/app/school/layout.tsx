'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Contact, LayoutDashboard, Users, School, UploadCloud, Clapperboard, KeyRound, Menu, X, ClipboardList, UserCheck } from 'lucide-react';
import Image from 'next/image';
import { isTokenExpired, clearSchoolSession } from '@/lib/session-token';
import { initialsOf } from './ui';

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On mobile the sidebar is an overlay drawer: close it once navigation lands
  // on a new route, otherwise it stays open on top of the page you just opened.
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // The drawer covers the page, so let the drawer scroll rather than the body
  // underneath it.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    const token = sessionStorage.getItem('schoolToken');
    const raw = sessionStorage.getItem('schoolUser');
    // An expired token is treated the same as a missing one: without this the
    // page mounts fine and every API call 401s with no way back to /login.
    if (!token || !raw || isTokenExpired(token)) {
      clearSchoolSession();
      router.replace('/login');
      return;
    }
    try {
      setUser(JSON.parse(raw));
      setReady(true);
    } catch {
      clearSchoolSession();
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = () => {
    clearSchoolSession();
    router.replace('/login');
  };

  if (!ready) return null;

  // Nav items carry no per-item colour: the active item is marked by the accent
  // fill alone, so the eye tracks one signal down the list instead of seven.
  // Icons match each page's own header icon, so the sidebar and the page you
  // land on always show the same mark for the same thing.
  const navItems = [
    { name: 'Dashboard',          href: '/school',                     icon: LayoutDashboard },
    { name: 'Olympiad IDs',       href: '/school/olympiad-ids',        icon: Contact },
    { name: 'My Students',        href: '/school/registered-students', icon: Users },
    { name: 'Student Requests',   href: '/school/student-requests',     icon: UserCheck },
    { name: 'Student Videos',     href: '/school/student-videos',      icon: Clapperboard },
    { name: 'Student Report',     href: '/school/reports',             icon: ClipboardList },
    { name: 'Upload Video',       href: '/school/upload-video',        icon: UploadCloud },
    { name: 'School Profile',     href: '/school/profile',             icon: School },
    { name: 'Manage Credentials', href: '/school/credentials',         icon: KeyRound },
  ];

  const initials = initialsOf(user?.name || 'School');

  return (
    // No inline fontFamily here: the root layout loads Inter through next/font
    // and exposes it as --font-inter (which `font-sans` resolves to). Naming
    // 'Inter' literally would miss that and silently fall back to a system face.
    <div className="min-h-screen bg-[#F6F7F9] font-sans">

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 z-30 flex items-center gap-3 px-4 bg-[#0E2A5C] border-b border-white/10">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          className="p-2 -ml-2 cursor-pointer rounded-lg text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md overflow-hidden flex-shrink-0">
            <Image src="/mittmee-icon.jpeg" alt="" width={28} height={28} className="object-cover w-full h-full" priority />
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-white">mittmee</span>
        </div>
        <span className="ml-auto w-8 h-8 rounded-full bg-white/15 text-white font-semibold text-[11px] flex items-center justify-center">
          {initials}
        </span>
      </header>

      {/* Drawer backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-40 bg-[#0E1726]/50 transition-opacity duration-200 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar */}
      <aside className={`w-[248px] max-w-[85vw] flex flex-col fixed top-0 h-screen z-50 bg-[#0E2A5C] transition-transform duration-200 ease-out lg:transition-none ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="lg:hidden absolute top-3 right-3 z-10 cursor-pointer p-2 rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X size={18} />
        </button>

        {/* Logo */}
        <div className="h-14 flex-shrink-0 flex items-center gap-2.5 px-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-md flex-shrink-0 overflow-hidden">
            <Image src="/mittmee-icon.jpeg" alt="" width={32} height={32} className="object-cover w-full h-full" priority />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-white leading-none">mittmee</p>
            <p className="text-[10.5px] text-white/50 mt-1 leading-none">School Panel</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/school'
              ? pathname === '/school'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 h-10 rounded-lg text-[13.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  isActive
                    ? 'bg-[#1559C7] text-white font-semibold'
                    : 'text-white/70 font-medium hover:bg-white/[0.07] hover:text-white'
                }`}
              >
                <Icon size={16} strokeWidth={2} className="flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Account + Logout */}
        <div className="px-3 pb-4 pt-3 flex-shrink-0 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="w-8 h-8 flex-shrink-0 rounded-full bg-white/15 text-white font-semibold text-[11px] flex items-center justify-center">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="text-white font-medium text-[12.5px] leading-tight truncate">{user?.name || 'School'}</p>
              <p className="text-white/50 text-[11px] mt-0.5 truncate">{user?.schoolId}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-1 flex cursor-pointer items-center gap-3 px-3 h-10 rounded-lg text-[13.5px] font-medium text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <LogOut size={16} strokeWidth={2} className="flex-shrink-0" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-[248px] min-h-screen pt-14 lg:pt-0">
        <div className="px-4 py-5 sm:px-6 max-w-[1560px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
