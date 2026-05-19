'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, School as SchoolIcon, Hash, LayoutDashboard } from 'lucide-react';

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
    { name: 'Dashboard', href: '/school', icon: LayoutDashboard },
    { name: 'Olympiad IDs', href: '/school/olympiad-ids', icon: Hash },
  ];

  return (
    <div className="flex min-h-screen bg-[#DDE2F9] text-[#432818]">
      <aside className="w-64 bg-[#06013E] flex flex-col fixed h-screen z-50 shadow-[10px_0_30px_rgba(6,1,62,0.25)]">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2 text-white/70 text-[10px] uppercase tracking-[0.15em] font-bold mb-1">
            <SchoolIcon size={14} /> School Panel
          </div>
          <h2 className="text-white font-bold text-base leading-tight truncate">
            {user?.name || 'School'}
          </h2>
          <p className="text-white/60 text-xs font-mono mt-1">{user?.schoolId}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-white text-[#06013E] shadow-sm font-semibold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                <Icon size={16} />
                <span className="font-semibold text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-white hover:bg-white/10 transition-colors"
          >
            <LogOut size={16} />
            <span className="font-semibold text-sm">Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 px-6 pt-4 pb-10 min-h-screen">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
