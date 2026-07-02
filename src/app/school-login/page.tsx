'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, User, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

export default function SchoolLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/school-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');

      sessionStorage.setItem('schoolToken', data.token);
      sessionStorage.setItem('schoolUser', JSON.stringify(data.user));
      router.push('/school');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#DDE2F9] p-4">
      <div className="w-full max-w-md bg-white border border-gray-300 shadow-lg">
        <div className="bg-[#06013E] text-white px-6 py-4 border-b-4 border-[#FF9000] flex items-center gap-3">
          <Image src="/mittmee-icon.jpeg" alt="mittmee" width={36} height={36} className="rounded-lg" />
          <div>
            <h1 className="text-base font-bold uppercase tracking-wider">School Portal Login</h1>
            <p className="text-xs text-gray-300 mt-0.5">mittmee Olympiad Management</p>
          </div>
        </div>

        <div className="p-7">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 mb-5 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase tracking-wide">
                School ID / Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  className="w-full h-10 border border-gray-300 rounded-none pl-10 pr-3 text-sm font-mono focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                  placeholder="MITT001"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  className="w-full h-10 border border-gray-300 rounded-none pl-10 pr-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#06013E] text-white font-semibold text-sm hover:bg-[#0a0660] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  Sign In <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-gray-200 text-center text-xs text-gray-500">
            Need help? Contact your mittmee coordinator.
          </div>
        </div>
      </div>
    </div>
  );
}
