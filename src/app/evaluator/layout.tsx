'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Star, LogOut, LayoutDashboard, ClipboardList, ChevronRight } from 'lucide-react';

interface EvaluatorData {
  id: string;
  evaluatorId: string;
  name: string;
  email: string;
}

const navItems = [
  { label: 'Dashboard', href: '/evaluator', icon: LayoutDashboard },
  { label: 'My Assignments', href: '/evaluator/assignments', icon: ClipboardList },
];

export default function EvaluatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [evaluator, setEvaluator] = useState<EvaluatorData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('evaluatorToken');
    const data = localStorage.getItem('evaluatorData');
    if (!token || !data) { router.replace('/evaluator/login'); return; }
    try { setEvaluator(JSON.parse(data)); } catch { router.replace('/evaluator/login'); }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('evaluatorToken');
    localStorage.removeItem('evaluatorData');
    router.replace('/evaluator/login');
  };

  if (!evaluator) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-100 flex flex-col fixed top-0 left-0 h-full z-30">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#004f9f] flex items-center justify-center">
              <Star size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Mittsure</p>
              <p className="text-xs font-black text-[#004f9f]">Evaluator</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(item => {
            const active = pathname === item.href;
            return (
              <button key={item.href} onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${active ? 'bg-[#004f9f] text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                <item.icon size={15} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight size={13} />}
              </button>
            );
          })}
        </nav>

        {/* Identity card */}
        <div className="px-3 pb-4 pt-2 border-t border-gray-100">
          <div className="bg-gray-50 rounded-2xl p-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#004f9f]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[#004f9f] font-black text-xs">
                  {evaluator.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-800 truncate">{evaluator.name}</p>
                <p className="text-[10px] font-mono text-[#004f9f] font-bold">{evaluator.evaluatorId}</p>
                <p className="text-[10px] text-gray-400 truncate">{evaluator.email}</p>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-full mt-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-red-500 hover:text-red-700 transition-colors py-1.5 rounded-lg hover:bg-red-50">
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
