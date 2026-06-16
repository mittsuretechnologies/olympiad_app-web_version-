'use client';

import { ClipboardList, Clock, CheckCircle, Construction } from 'lucide-react';

export default function ReviewerDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-[#004f9f]">Dashboard</h1>

      {/* Coming soon modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pending Reviews', value: '—', icon: Clock, color: 'bg-orange-50 text-orange-500' },
          { label: 'Completed Today', value: '—', icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          { label: 'Total Assigned', value: '—', icon: ClipboardList, color: 'bg-blue-50 text-[#004f9f]' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color}`}>
              <card.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-300">{card.value}</p>
              <p className="text-xs text-gray-400">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Construction size={28} className="text-[#004f9f]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Reviewer Modules Coming Soon</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            Scanner-linked review tasks, marking sheets, and evaluation history will appear here as modules are added.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {['Answer Sheet Review', 'Mark Entry', 'Evaluation History', 'Scanner Queue'].map(mod => (
            <span key={mod} className="px-3 py-1 bg-gray-100 text-gray-400 text-xs font-semibold rounded-full">
              {mod}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
