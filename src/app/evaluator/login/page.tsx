'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, AlertCircle, LogIn } from 'lucide-react';

export default function EvaluatorLoginPage() {
  const router = useRouter();
  const [evaluatorId, setEvaluatorId] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!evaluatorId.trim() || !password.trim()) { setError('Evaluator ID and password are required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/evaluator/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluatorId: evaluatorId.trim().toUpperCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('adminUser');
      sessionStorage.removeItem('schoolToken');
      sessionStorage.removeItem('schoolUser');
      sessionStorage.removeItem('reviewerToken');
      sessionStorage.removeItem('reviewerData');
      sessionStorage.setItem('evaluatorToken', data.token);
      sessionStorage.setItem('evaluatorData', JSON.stringify(data.evaluator));
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#004f9f]/5 via-white to-blue-50/30 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl overflow-hidden mb-4 shadow-lg">
            <Image src="/mittmee-icon.jpeg" alt="mittmee" width={56} height={56} className="h-full w-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-[#004f9f]">Evaluator Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in with your Evaluator credentials</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Evaluator ID</label>
            <input
              type="text"
              placeholder="EVL1234"
              value={evaluatorId}
              onChange={e => setEvaluatorId(e.target.value.toUpperCase())}
              autoFocus
              autoComplete="off"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono font-bold tracking-wider text-[#004f9f] uppercase focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
                className="w-full pr-10 pl-4 border border-gray-200 rounded-xl py-3 text-sm focus:outline-none focus:border-[#004f9f] focus:ring-2 focus:ring-[#004f9f]/10"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertCircle size={13} className="shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 bg-[#004f9f] text-white text-sm font-bold rounded-xl hover:bg-[#003d7a] disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Contact admin if you&apos;ve lost access to your credentials.
        </p>
      </div>
    </div>
  );
}
