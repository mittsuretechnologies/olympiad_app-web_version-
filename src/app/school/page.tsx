'use client';

import { LayoutDashboard } from 'lucide-react';

export default function SchoolDashboardPage() {
  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Dashboard</h1>
        </div>
        <div className="text-xs text-gray-300">School overview</div>
      </div>

      <div className="p-10 text-center">
        <p className="text-gray-500 text-sm">Dashboard widgets coming soon.</p>
      </div>
    </div>
  );
}
