'use client';

import { Star, Video, ClipboardCheck, Clock, Sparkles } from 'lucide-react';

const upcomingModules = [
  { icon: Video, label: 'Video Queue', desc: 'Review assigned olympiad videos' },
  { icon: ClipboardCheck, label: 'Mark Sheet', desc: 'Score videos on defined criteria' },
  { icon: Clock, label: 'History', desc: 'Track all your past evaluations' },
];

export default function EvaluatorDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Evaluator Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Your evaluation workspace is being prepared.</p>
      </div>

      {/* Coming soon card */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-[#004f9f] to-[#003d7a] px-8 py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-5">
            <Star size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-black text-white">Evaluator Module</h2>
          <p className="text-white/60 mt-2 text-sm max-w-sm mx-auto">
            The video evaluation workspace is currently in development and will be available soon.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-white/80 bg-white/10 px-3 py-1.5 rounded-full">
            <Sparkles size={11} />
            Coming Soon
          </div>
        </div>

        <div className="px-8 py-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">What&apos;s coming</p>
          <div className="grid grid-cols-1 gap-3">
            {upcomingModules.map(m => (
              <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className="w-8 h-8 rounded-lg bg-[#004f9f]/10 flex items-center justify-center flex-shrink-0">
                  <m.icon size={15} className="text-[#004f9f]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800">{m.label}</p>
                  <p className="text-[11px] text-gray-400">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
