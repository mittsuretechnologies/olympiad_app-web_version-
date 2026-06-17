'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Hash, LayoutDashboard, Users, UserCircle, ChevronRight, UploadCloud, PlaySquare } from 'lucide-react';
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="flex min-h-screen bg-[#F6F9FF]">

      {/* â”€â”€ Sidebar â”€â”€ */}
      <aside className="w-60 flex flex-col fixed h-screen z-50 bg-white border-r border-gray-200 shadow-sm">

        {/* Logo */}
        <div className="px-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
          <Image
            src="/logo-CW-uU9TX.jpg"
            alt="Mittsure Technologies"
            width={160}
            height={52}
            className="object-contain w-28 scale-[1.5] mix-blend-multiply -mt-3 -mb-3"
            priority
          />
        </div>

        {/* School identity card */}
        <div className="mx-3 mt-3 mb-2 rounded-xl bg-gradient-to-br from-[#06013E] to-[#1a0f6e] p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FF9000] text-[#004f9f] font-black text-sm flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-xs leading-tight truncate">{user?.name || 'School'}</p>
              <p className="text-white/50 text-[10px] font-mono mt-0.5">{user?.schoolId}</p>
            </div>
            <div className="ml-auto flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/school'
              ? pathname === '/school'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                  isActive
                    ? 'bg-[#06013E] text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-[#004f9f]'
                }`}
              >
                {/* active accent */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF9000] rounded-r-full" />
                )}
                <Icon size={15} className={isActive ? 'text-[#FF9000]' : 'text-gray-400 group-hover:text-[#004f9f]'} />
                <span className="text-sm font-semibold flex-1">
                  {item.name}
                </span>
                {isActive && <ChevronRight size={12} className="text-white/40" />}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#06013E] hover:bg-red-600 hover:text-white transition-all group"
          >
            <LogOut size={15} className="group-hover:text-white" />
            <span className="text-sm font-semibold">Logout</span>
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main content â”€â”€ */}
      <main className="flex-1 ml-60 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium text-[#004f9f]">
              {pathname === '/school' ? 'Dashboard'
                : pathname.startsWith('/school/olympiad-ids') ? 'Olympiad IDs'
                : pathname.startsWith('/school/registered-students') ? 'My Students'
                : pathname.startsWith('/school/student-videos') ? 'Student Videos'
                : pathname.startsWith('/school/upload-video') ? 'Upload Video'
                : pathname.startsWith('/school/profile') ? 'School Profile'
                : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">{user?.name}</span>
            <div className="w-7 h-7 rounded-full bg-[#06013E] text-[#FF9000] font-black text-[11px] flex items-center justify-center">
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 px-6 py-5">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}

