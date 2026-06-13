'use client';

import { useState, useEffect } from 'react';
import { School, Users, Trophy, TrendingUp, ArrowUpRight, Activity, Calendar, Bell, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';

type DashboardStats = {
  registeredSchools: number;
  totalStudents: number;
  activeOlympiads: number | null;
  revenue: number | null;
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  // "—" while loading or unavailable; real number once fetched.
  const num = (v: number | null | undefined) =>
    loading ? '…' : v === null || v === undefined ? '—' : v.toLocaleString('en-IN');

  const stats = [
    { label: 'Registered Schools', value: num(data?.registeredSchools), icon: School, color: 'text-orange-600', bg: 'bg-orange-50', trend: 'Live' },
    { label: 'Total Students', value: num(data?.totalStudents), icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', trend: 'Live' },
    { label: 'Active Olympiads', value: num(data?.activeOlympiads), icon: Trophy, color: 'text-orange-700', bg: 'bg-orange-100', trend: 'New' },
    { label: 'Revenue', value: data?.revenue == null ? '—' : `₹${data.revenue.toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '0%' },
  ];

  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <div className="relative w-96 group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E67E00]/40 group-focus-within:text-[#E67E00] transition-colors" />
            <input
              type="text"
              placeholder="Search resources..."
              className="w-full bg-white/80 border-2 border-white rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-[#E67E00] focus:ring-4 focus:ring-[#E67E00]/5 transition-all placeholder:text-slate-400 shadow-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button className="relative p-3 rounded-2xl bg-white border-2 border-white text-[#E67E00] hover:scale-105 transition-all shadow-sm">
            <Bell size={20} />
            <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          <div className="flex items-center gap-4 pl-6 border-l border-[#432818]/10">
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-[#432818]">Mittsure Admin</span>
              <span className="text-[10px] uppercase tracking-wider text-[#E67E00] font-black">Super Admin</span>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center font-bold text-[#E67E00] text-lg shadow-lg border-2 border-white overflow-hidden">
              <div className="relative w-full h-full">
                <Image src="/Mittsure_LOGO_updated_page-0001-removebg-preview.png" alt="Admin" fill className="object-contain p-1" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-[#432818] tracking-tight">System Overview</h1>
          <p className="text-[#432818]/60 font-bold mt-1 uppercase text-xs tracking-widest">Real-time Mittsure Portal Metrics</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-5 py-2.5 rounded-2xl border-2 border-white shadow-xl shadow-orange-500/5 text-sm font-black text-[#FF9000]">
          <Calendar size={18} />
          {today}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-7 rounded-[2rem] border-2 border-white shadow-xl shadow-orange-900/5 hover:border-[#FF9000]/20 hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-500 group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`w-14 h-14 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-black/5`}>
                <stat.icon size={28} />
              </div>
              <span className={`text-[10px] font-black ${stat.color} bg-white px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-sm border border-orange-50`}>
                {stat.trend} <ArrowUpRight size={12} />
              </span>
            </div>
            
            <div className="text-5xl font-black mb-1 tracking-tight text-[#432818]">{stat.value}</div>
            <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-white shadow-xl shadow-orange-900/5 flex flex-col items-center justify-center min-h-[400px] group cursor-pointer">
             <div className="w-24 h-24 rounded-[2.5rem] bg-orange-50 flex items-center justify-center mb-8 text-orange-200 group-hover:bg-[#FF9000] group-hover:text-white transition-all duration-700 shadow-inner">
              <Activity size={48} className="group-hover:rotate-12 transition-transform duration-500" />
            </div>
            <h3 className="text-2xl font-black mb-3 text-[#432818]">System Awaiting Input</h3>
            <p className="text-slate-500 max-w-sm text-center text-sm font-bold leading-relaxed px-6 opacity-60">
              Welcome to the new Mittsure Portal. Begin by registering schools to unlock real-time participation analytics.
            </p>
            <button className="bg-[#FF9000] text-white px-10 py-4 rounded-2xl font-black text-sm mt-10 shadow-2xl shadow-orange-500/40 hover:-translate-y-1 hover:shadow-orange-500/60 transition-all">
              Launch Registration Flow
            </button>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-gradient-to-br from-[#FF9000] to-[#FF6B00] p-10 rounded-[2.5rem] text-white relative overflow-hidden shadow-2xl shadow-orange-500/40">
              <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/20 rounded-full blur-3xl"></div>
              <h2 className="text-2xl font-black mb-4 leading-tight">Ready for Sessions?</h2>
              <p className="text-white/80 text-sm font-bold mb-8 leading-relaxed">Invigilate and manage Olympiad exams across all registered centers.</p>
              <button className="w-full bg-white text-[#FF9000] py-4 rounded-2xl font-black text-sm shadow-2xl shadow-black/10 hover:scale-105 transition-all">
                START NEW SESSION
              </button>
           </div>
          
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-white shadow-xl shadow-orange-900/5 space-y-5">
            <h3 className="font-black text-[#432818] mb-6 px-2 text-lg uppercase tracking-tight">Quick Shortcuts</h3>
            {[
              { label: 'Register New School', icon: School, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'Financial Audit', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' }
            ].map((action, i) => (
              <button key={i} className="w-full p-4 flex items-center gap-5 rounded-[1.5rem] hover:bg-orange-50/50 transition-all group text-left border-2 border-transparent hover:border-orange-100">
                <div className={`w-12 h-12 rounded-2xl ${action.bg} ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm`}>
                  <action.icon size={20} />
                </div>
                <span className="text-sm font-black text-[#432818]/80 group-hover:text-[#FF9000] transition-colors">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
