'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import Image from 'next/image';

export default function ReviewerLoginPage() {
  const router = useRouter();
  const [reviewerId, setReviewerId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!reviewerId.trim() || !password.trim()) { setError('Reviewer ID and password required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/reviewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      localStorage.setItem('reviewerToken', data.token);
      localStorage.setItem('reviewerUser', JSON.stringify(data.reviewer));
      router.replace('/reviewer');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F9FF] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4">
            <Image src="/logo-CW-uU9TX.jpg" alt="Mittsure" width={120} height={40} className="object-contain mix-blend-multiply" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#004f9f] px-6 py-5">
            <h1 className="text-white font-bold text-lg">Reviewer Portal</h1>
            <p className="text-white/60 text-xs mt-0.5">Sign in to your reviewer account</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Reviewer ID</label>
              <input
                type="text" placeholder="e.g. RVW1234"
                value={reviewerId} onChange={e => setReviewerId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus autoComplete="off"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full pr-10 pl-3 border border-gray-200 rounded-xl py-2.5 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-1 focus:ring-[#004f9f]"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} className="flex-shrink-0" /> {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading}
              className="w-full bg-[#004f9f] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#003d7a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
              {loading ? <Loader2 size={15} className="animate-spin" /> : 'Sign In'}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-5">Mittsure Olympiad · Reviewer Portal</p>
      </div>
    </div>
  );
}
