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
    <div className="min-h-screen bg-[#F1F3F7]" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Sidebar */}
      <aside className="w-[220px] flex flex-col fixed top-0 h-screen z-40">
        <div className="flex-1 flex flex-col overflow-hidden">

        {/* Logo */}
        <div className="h-16 flex-shrink-0 flex items-center gap-2.5 px-6">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            <Image
              src="/mittmee-icon.jpeg"
              alt="mittmee"
              width={44}
              height={44}
              className="object-cover w-full h-full"
              priority
            />
          </div>
          <span className="text-xl font-bold tracking-tight"><span className="text-[#2357D8]">mitt</span><span className="text-[#3CB043]">mee</span></span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto pt-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/school'
              ? pathname === '/school'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 pl-4 pr-3 h-12 rounded-xl transition-colors duration-150 ${
                  isActive
                    ? 'bg-white text-[#2357D8] shadow-[0_1px_2px_rgba(16,24,40,0.06)]'
                    : 'text-[#1F2937] hover:bg-white/60'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-full bg-[#2357D8]" />
                )}
                <Icon
                  size={20}
                  strokeWidth={1.75}
                  className={isActive ? 'text-[#2357D8]' : 'text-[#64748B]'}
                />
                <span className={`text-[15px] leading-none flex-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Account switcher + Logout */}
        <div className="px-3 pb-4 pt-3 flex-shrink-0">
          <div className="rounded-xl border border-[#E7EBF2] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-[#2357D8] text-white font-semibold text-xs flex items-center justify-center">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[#1F2937] font-semibold text-[13px] leading-tight truncate">{user?.name || 'School'}</p>
                <p className="text-[#64748B] text-[11px] mt-0.5 truncate">{user?.schoolId}</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full mt-3 flex items-center gap-3 px-3 h-11 rounded-xl text-[#64748B] hover:bg-white/60 hover:text-[#1F2937] transition-colors duration-150"
          >
            <LogOut size={18} strokeWidth={1.75} className="flex-shrink-0" />
            <span className="text-[14px] font-medium">Log out</span>
          </button>
        </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[220px] min-h-screen flex flex-col py-3 pr-3">
        <div className="flex-1 bg-white border border-[#E7EBF2] rounded-2xl shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="px-8 py-8 max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
