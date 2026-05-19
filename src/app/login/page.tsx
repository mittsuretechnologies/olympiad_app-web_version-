'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, User, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.role === 'SCHOOL') {
        localStorage.setItem('schoolToken', data.token);
        localStorage.setItem('schoolUser', JSON.stringify(data.user));
      } else {
        localStorage.setItem('token', data.token);
      }

      router.push(data.redirect || '/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <motion.div 
        className="w-full max-w-[450px] p-10 glass z-10 m-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-10">
          <motion.h1
            className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Mittsure
          </motion.h1>
          <p className="text-slate-400">Olympiad Portal Login</p>
        </div>

        {error && (
          <motion.div 
            className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-6 text-sm flex items-center gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <AlertCircle size={18} />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Email or School ID</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                className="input-field pl-10"
                placeholder="admin@mittsure.com or MITT001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="password"
                className="input-field pl-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Sign In <ChevronRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-slate-500 text-xs">
          &copy; 2026 Mittsure Technologies. All rights reserved.
        </div>
      </motion.div>
    </div>
  );
}
