'use client';

import { useState } from 'react';
import { authFetch } from '@/lib/swr';

export default function RegisterUploaderPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await authFetch('/api/uploaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to register uploader' });
      } else {
        setMessage({
          type: 'success',
          text: `Uploader registered successfully! Assigned ID: ${data.uploaderId}`,
        });
        setName('');
        setEmail('');
        setPhone('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const labelCls = 'block text-xs font-bold text-[#004f9f] mb-1.5 uppercase tracking-wide';
  const inputCls =
    'w-full h-10 border border-gray-300 rounded-none px-3 text-sm text-[#432818] placeholder:text-gray-400 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] transition-all bg-white';

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-[#004f9f]">Register New Uploader</h1>
      <div className="max-w-3xl bg-[#FFFEFE] border border-gray-300 shadow-sm">
      <div className="p-6">
        {message && (
          <div
            className={`mb-5 px-4 py-3 text-sm font-medium border ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-300'
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
          >
            {message.text}
          </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <label className={labelCls}>
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={inputCls}
                placeholder="Uploader name"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                placeholder="uploader@example.com"
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
                placeholder="10 digit mobile"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-900">
            Uploaders can scan/search any Olympiad ID across all schools after login. School allocations are not needed — the system resolves school context from the ID itself.
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => {
                setName('');
                setEmail('');
                setPhone('');
              }}
              disabled={loading}
              className="h-10 px-5 bg-white border border-gray-400 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-6 bg-[#009846] text-white font-semibold text-sm hover:bg-[#007a38] transition-colors disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Create Uploader'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

