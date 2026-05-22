'use client';

import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, Hash, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SchoolDashboardPage() {
  const [stats, setStats] = useState({
    totalIds: 0,
    registered: 0,
    pending: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('schoolToken');
    if (!token) return;

    Promise.all([
      fetch('/api/school/me/olympiad-ids', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/school/me/registered-students', { headers: { Authorization: `Bearer ${token}` } })
    ]).then(async ([resIds, resReg]) => {
      const ids = await resIds.json();
      const reg = await resReg.json();
      
      const total = Array.isArray(ids) ? ids.length : 0;
      const registered = Array.isArray(reg) ? reg.length : 0;
      
      setStats({
        totalIds: total,
        registered: registered,
        pending: total - registered
      });
    }).finally(() => setLoading(false));
  }, []);

  const Card = ({ title, value, icon: Icon, color, link, linkText }: any) => (
    <div className="bg-white border border-gray-300 shadow-sm relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{title}</p>
            <h3 className="text-3xl font-black text-[#06013E]">{value}</h3>
          </div>
          <div className={`p-3 rounded-lg bg-gray-50 text-gray-400 group-hover:scale-110 transition-transform`}>
            <Icon size={24} />
          </div>
        </div>
        <Link href={link} className="flex items-center gap-1.5 text-xs font-bold text-[#06013E] hover:underline uppercase tracking-tight">
          {linkText} <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-300 shadow-sm">
        <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
          <div className="flex items-center gap-3">
            <LayoutDashboard size={20} />
            <h1 className="text-base font-bold uppercase tracking-wider">School Dashboard</h1>
          </div>
          <div className="text-xs text-gray-300 italic">Welcome to your administration panel</div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              title="Total Olympiad IDs" 
              value={stats.totalIds} 
              icon={Hash} 
              color="bg-blue-600" 
              link="/school/olympiad-ids"
              linkText="View Allocations"
            />
            <Card 
              title="Registered Students" 
              value={stats.registered} 
              icon={CheckCircle2} 
              color="bg-green-600" 
              link="/school/registered-students"
              linkText="View My Students"
            />
            <Card 
              title="Pending Registrations" 
              value={stats.pending} 
              icon={Users} 
              color="bg-orange-600" 
              link="/school/olympiad-ids"
              linkText="Check Roll Numbers"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 shadow-sm">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-300 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#06013E]">Quick Actions</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-4">
            <Link href="/school/olympiad-ids" className="p-4 border border-gray-200 hover:border-[#06013E] hover:bg-gray-50 transition-all rounded text-center group">
               <Hash className="mx-auto mb-2 text-gray-400 group-hover:text-[#06013E]" size={24} />
               <p className="text-xs font-bold text-gray-600">Export IDs</p>
            </Link>
            <Link href="/school/registered-students" className="p-4 border border-gray-200 hover:border-[#06013E] hover:bg-gray-50 transition-all rounded text-center group">
               <Users className="mx-auto mb-2 text-gray-400 group-hover:text-[#06013E]" size={24} />
               <p className="text-xs font-bold text-gray-600">Student List</p>
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-300 shadow-sm">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-300 flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#06013E]">Announcement</h2>
          </div>
          <div className="p-6">
            <div className="bg-blue-50 border-l-4 border-blue-600 p-4">
              <p className="text-sm font-bold text-blue-900 mb-1">Olympiad 2026 Season</p>
              <p className="text-xs text-blue-800 leading-relaxed text-justify">
                Distribute the allocated Olympiad IDs to your students. Once they register via the TalentOlympiad App, their records will appear in your 'My Students' section.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

