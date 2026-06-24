'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Hash, LayoutDashboard, Users, UserCircle, UploadCloud, PlaySquare } from 'lucide-react';
import Image from 'next/image';

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('schoolToken');
    const raw = localStorage.getItem('schoolUser');
    if (!token || !raw) {
      router.replace('/login');
      return;
    }
    try {
      setUser(JSON.parse(raw));
      setReady(true);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('schoolToken');
    localStorage.removeItem('schoolUser');
    router.replace('/login');
  };

  if (!ready) return null;

  const navItems = [
    { name: 'Dashboard',      href: '/school',                       icon: LayoutDashboard },
    { name: 'Olympiad IDs',   href: '/school/olympiad-ids',          icon: Hash },
    { name: 'My Students',    href: '/school/registered-students',   icon: Users },
    { name: 'Student Videos', href: '/school/student-videos',        icon: PlaySquare },
    { name: 'Upload Video',   href: '/school/upload-video',          icon: UploadCloud },
    { name: 'School Profile', href: '/school/profile',               icon: UserCircle },
  ];

  const initials = (user?.name || 'S')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#E7F5D9]">

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="w-60 flex flex-col fixed h-screen z-50 bg-[#0D1A06]">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4 flex-shrink-0 flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-white flex items-center justify-center flex-shrink-0 overflow-hidden p-1">
            <Image
              src="/Mittsure_LOGO_updated_page-0001-removebg-preview.png"
              alt="Mittsure"
              width={32}
              height={32}
              className="object-contain w-full h-full"
              priority
            />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">Mitmee</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/school'
              ? pathname === '/school'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-[#0D1A06] font-semibold shadow-sm'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon size={16} strokeWidth={2.5} className={isActive ? 'text-[#0D1A06]' : 'text-white'} />
                <span className="text-sm flex-1">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* School identity card + Logout */}
        <div className="p-3 flex-shrink-0 space-y-2">
          <div className="rounded-xl bg-white/5 border border-white/10 p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#FF9000] text-[#0D1A06] font-black text-sm flex items-center justify-center flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-xs leading-tight truncate">{user?.name || 'School'}</p>
                <p className="text-white/40 text-[10px] font-mono mt-0.5">{user?.schoolId}</p>
              </div>
              <div className="ml-auto flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut size={15} />
            <span className="text-sm font-semibold">Log out</span>
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main content â”€â”€ */}
      <main className="flex-1 ml-60 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-8 flex-shrink-0 sticky top-0 z-40 bg-[#E7F5D9]">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-[#0D1A06]">
              {pathname === '/school' ? `Hello, ${(user?.name || 'School').split(' ')[0]}!`
                : pathname.startsWith('/school/olympiad-ids') ? 'Olympiad IDs'
                : pathname.startsWith('/school/registered-students') ? 'My Students'
                : pathname.startsWith('/school/student-videos') ? 'Student Videos'
                : pathname.startsWith('/school/upload-video') ? 'Upload Video'
                : pathname.startsWith('/school/profile') ? 'School Profile'
                : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:block">{user?.name}</span>
            <div className="w-8 h-8 rounded-full bg-[#0D1A06] text-[#FF9000] font-black text-[11px] flex items-center justify-center">
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 px-8 pb-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}

