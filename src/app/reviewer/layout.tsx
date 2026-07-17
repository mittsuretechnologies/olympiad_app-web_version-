'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, LayoutDashboard, ChevronRight, ClipboardList, Menu, X } from 'lucide-react';

export default function ReviewerLayout({ children }: { children: React.ReactNode }) {
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
    if (pathname === '/reviewer/login') { setReady(true); return; }
    const token = sessionStorage.getItem('reviewerToken');
    const raw = localStorage.getItem('reviewerUser');
    if (!token || !raw) { router.replace('/reviewer/login'); return; }
    try { setUser(JSON.parse(raw)); setReady(true); }
    catch { router.replace('/reviewer/login'); }
  }, [router, pathname]);

  const handleLogout = () => {
    sessionStorage.removeItem('reviewerToken');
    localStorage.removeItem('reviewerUser');
    router.replace('/reviewer/login');
  };

  if (!ready) return null;
  if (pathname === '/reviewer/login') return <>{children}</>;

  const navItems = [
    { name: 'Dashboard', href: '/reviewer', icon: LayoutDashboard },
    { name: 'My Tasks',  href: '/reviewer/tasks', icon: ClipboardList },
  ];

  const initials = (user?.name || 'R').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#F6F9FF]">

      {/* Drawer backdrop */}
      <div
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar */}
      <aside className={`w-60 max-w-[85vw] flex flex-col fixed h-screen z-50 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:transition-none shadow-2xl shadow-black/20 lg:shadow-sm ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="lg:hidden absolute top-3 right-3 z-10 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>
        <div className="px-4 py-4 border-b border-gray-100 flex-shrink-0 flex items-center justify-center gap-2">
          <Image src="/mittmee-icon.jpeg" alt="mittmee" width={32} height={32} className="rounded-lg object-cover" priority />
          <span className="text-base font-bold tracking-tight"><span className="text-[#1559C7]">mitt</span><span className="text-[#3CB043]">mee</span></span>
        </div>

        {/* Identity card */}
        <div className="mx-3 mt-3 mb-2 rounded-xl bg-gradient-to-br from-[#004f9f] to-[#003d7a] p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FF9000] text-white font-black text-sm flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-xs leading-tight truncate">{user?.name || 'Reviewer'}</p>
              <p className="text-white/50 text-[10px] font-mono mt-0.5">{user?.reviewerId}</p>
            </div>
            <div className="ml-auto flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pt-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = item.href === '/reviewer' ? pathname === '/reviewer' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                  isActive ? 'bg-[#004f9f] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-[#004f9f]'
                }`}>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#FF9000] rounded-r-full" />}
                <Icon size={15} className={isActive ? 'text-[#FF9000]' : 'text-gray-400 group-hover:text-[#004f9f]'} />
                <span className={`text-sm font-semibold flex-1 ${isActive ? 'text-white' : ''}`}>{item.name}</span>
                {isActive && <ChevronRight size={12} className="text-white/40" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all group">
            <LogOut size={15} className="group-hover:text-red-500" />
            <span className="text-sm font-semibold">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 lg:ml-60 min-h-screen flex flex-col">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#004f9f] transition-colors"
            >
              <Menu size={20} />
            </button>
            <span className="text-base font-medium text-[#004f9f] truncate">
              {pathname === '/reviewer' ? 'Dashboard'
                : pathname.startsWith('/reviewer/tasks') ? 'My Tasks'
                : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">{user?.name}</span>
            <div className="w-7 h-7 rounded-full bg-[#004f9f] text-[#FF9000] font-black text-[11px] flex items-center justify-center">
              {initials}
            </div>
          </div>
        </header>
        <div className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
