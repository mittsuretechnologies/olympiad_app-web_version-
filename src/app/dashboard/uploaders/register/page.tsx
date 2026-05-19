'use client';

import { useState } from 'react';

export default function RegisterUploaderPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [credentials, setCredentials] = useState<{
    uploaderId: string;
    username: string;
    password: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setCredentials(null);
    try {
      const res = await fetch('/api/uploaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to register uploader' });
      } else {
        setMessage({
          type: 'success',
          text: `Uploader registered successfully! Assigned ID: ${data.uploaderId}`,
        });
        if (data.credentials) {
          setCredentials({
            uploaderId: data.uploaderId,
            username: data.credentials.username,
            password: data.credentials.password,
          });
        }
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

  const labelCls = 'block text-xs font-bold text-[#06013E] mb-1.5 uppercase tracking-wide';
  const inputCls =
    'w-full h-10 border border-gray-300 rounded-none px-3 text-sm text-[#432818] placeholder:text-gray-400 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] transition-all bg-white';

  return (
    <div className="bg-white border border-gray-300 shadow-sm max-w-3xl mx-auto">
      <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
        <h1 className="text-base font-bold uppercase tracking-wider">Register New Uploader</h1>
      </div>

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

        {credentials && (
          <div className="mb-6 bg-yellow-50 border border-yellow-300 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#06013E] uppercase tracking-wider">
                Uploader Login Credentials (save now — password will not be shown again)
              </h3>
              <button
                type="button"
                onClick={() => {
                  const text = `Uploader ID: ${credentials.uploaderId}\nUsername: ${credentials.username}\nPassword: ${credentials.password}`;
                  navigator.clipboard.writeText(text);
                }}
                className="text-xs font-semibold text-[#06013E] underline hover:text-[#0a0660]"
              >
                Copy all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Uploader ID</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.uploaderId}</div>
              </div>
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Username</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.username}</div>
              </div>
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Password</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.password}</div>
              </div>
            </div>
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
              className="h-10 px-6 bg-[#06013E] text-white font-semibold text-sm hover:bg-[#0a0660] transition-colors disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Create Uploader'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
