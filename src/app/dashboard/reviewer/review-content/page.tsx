'use client';

import { Construction } from 'lucide-react';

export default function ReviewContentPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-[#004f9f]">Review Content</h1>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-16 flex flex-col items-center justify-center gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Construction size={28} className="text-[#004f9f]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Coming Soon</h2>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            Reviewer content evaluation module is under development. Check back soon.
          </p>
        </div>
      </div>
    </div>
  );
}
