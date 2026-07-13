'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Hash, LayoutDashboard, Users, UserCircle, UploadCloud, PlaySquare, KeyRound } from 'lucide-react';
import Image from 'next/image';

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('schoolToken');
    const raw = sessionStorage.getItem('schoolUser');
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
    sessionStorage.removeItem('schoolToken');
    sessionStorage.removeItem('schoolUser');
    router.replace('/login');
  };

  if (!ready) return null;

  const navItems = [
    { name: 'Dashboard',      href: '/school',                       icon: LayoutDashboard, gradient: 'from-[#2a78d6] to-[#1559C7]' },
    { name: 'Olympiad IDs',   href: '/school/olympiad-ids',          icon: Hash,            gradient: 'from-[#1baf7a] to-[#0d9f6e]' },
    { name: 'My Students',    href: '/school/registered-students',   icon: Users,           gradient: 'from-[#eda100] to-[#d98600]' },
    { name: 'Student Videos', href: '/school/student-videos',        icon: PlaySquare,      gradient: 'from-[#7a6ad6] to-[#4a3aa7]' },
    { name: 'Upload Video',   href: '/school/upload-video',          icon: UploadCloud,     gradient: 'from-[#e34948] to-[#c73a3a]' },
    { name: 'School Profile', href: '/school/profile',               icon: UserCircle,      gradient: 'from-[#eb6834] to-[#d95926]' },
    { name: 'Manage Credentials', href: '/school/credentials',       icon: KeyRound,        gradient: 'from-[#7a6ad6] to-[#4a3aa7]' },
  ];

  const initials = (user?.name || 'S')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-[#F1F3F7]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Sidebar */}
      <aside className="w-[260px] flex flex-col fixed top-0 h-screen z-40 bg-gradient-to-b from-[#0d1a6e] via-[#123a8f] to-[#052E5C]">
        <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute -top-10 -right-16 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 -left-14 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

        {/* Logo */}
        <div className="h-16 flex-shrink-0 flex items-center gap-2.5 px-6 relative">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
            <Image
              src="/mittmee-icon.jpeg"
              alt="mittmee"
              width={44}
              height={44}
              className="object-cover w-full h-full"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight"><span className="text-white">mitt</span><span className="text-[#4ADE80]">mee</span></span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1.5 overflow-y-auto pt-6 relative [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/school'
              ? pathname === '/school'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 pl-4 pr-3 h-12 rounded-xl transition-all duration-150 ${
                  isActive
                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)]`
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isActive ? 'bg-white/20' : 'bg-white/5'
                }`}>
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    className="text-white"
                  />
                </div>
                <span className={`text-[14px] leading-none flex-1 ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Account switcher + Logout */}
        <div className="px-3 pb-4 pt-3 flex-shrink-0 relative">
          <div className="rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.1)] p-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#eda100] to-[#eb6834] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#123a8f]" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold text-[13px] leading-tight truncate">{user?.name || 'School'}</p>
                <p className="text-white/50 text-[11px] mt-0.5 truncate">{user?.schoolId}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-3 flex items-center gap-3 px-3 h-11 rounded-xl text-white/60 hover:bg-red-500/15 hover:text-red-200 transition-colors duration-150"
          >
            <LogOut size={18} strokeWidth={1.75} className="flex-shrink-0" />
            <span className="text-[14px] font-medium">Log out</span>
          </button>
        </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[260px] min-h-screen">
        <div className="px-2.5 py-2.5 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}
