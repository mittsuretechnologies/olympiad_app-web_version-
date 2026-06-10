'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import { KeyRound, Loader2, Search, RotateCw, Copy, Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UploaderCred {
  id: string;
  uploaderId: string;
  name: string;
  email?: string;
  phone?: string;
  username: string;
  status: string;
  updatedAt: string;
  createdAt: string;
}

export default function UploaderCredentialsPage() {
  const { data, isLoading: loading, mutate } = useSWR<UploaderCred[]>('/api/credentials/uploaders', fetcher);
  const rows: UploaderCred[] = Array.isArray(data) ? data : [];
  const [search, setSearch] = useState('');
  const [resetTarget, setResetTarget] = useState<UploaderCred | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [newCreds, setNewCreds] = useState<{
    uploaderId: string;
    name: string;
    username: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);


  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.uploaderId?.toLowerCase().includes(q) ||
        r.username?.toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const handleReset = async () => {
    if (!resetTarget) return;
    setResetBusy(true);
    try {
      const res = await fetch(`/api/uploaders/${resetTarget.id}/reset`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to reset');
        return;
      }
      setNewCreds({
        uploaderId: resetTarget.uploaderId,
        name: resetTarget.name,
        username: data.username,
        password: data.password,
      });
      setResetTarget(null);
      mutate();
    } catch {
      alert('Network error');
    } finally {
      setResetBusy(false);
    }
  };

  const copyAll = () => {
    if (!newCreds) return;
    const text = `Uploader: ${newCreds.name} (${newCreds.uploaderId})\nUsername: ${newCreds.username}\nPassword: ${newCreds.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      <div className="bg-[#009846] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <KeyRound size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">Manage Uploader Credentials</h1>
        </div>
        <div className="text-xs text-gray-200">Reset passwords for mobile app login</div>
      </div>

      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          <span className="text-gray-600">Total Uploaders: </span>
          <span className="font-bold text-[#06013E]">{rows.length}</span>
        </div>
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search by name, uploader ID, username, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Uploader ID</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Username</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Password</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase border-r border-gray-300">Updated</th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase w-32">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center text-gray-500 text-sm">
                  {rows.length === 0 ? 'No uploaders registered yet.' : 'No matches.'}
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-yellow-50`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#06013E]">{r.uploaderId}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono">{r.username}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-500 italic text-xs">
                    Hidden (use Reset to view)
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-xs">{r.email || '-'}</td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                        r.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800 border border-green-300'
                          : 'bg-gray-100 text-gray-700 border border-gray-300'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-xs">{new Date(r.updatedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      onClick={() => setResetTarget(r)}
                      className="inline-flex items-center gap-1.5 bg-[#009846] text-white px-2.5 py-1 text-xs font-semibold hover:bg-[#007a38]"
                    >
                      <RotateCw className="w-3 h-3" /> Reset
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-200 flex justify-between items-center">
        <span>
          Showing <span className="font-bold">{filtered.length}</span> of{' '}
          <span className="font-bold">{rows.length}</span>
        </span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>

      {/* Reset confirm */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="max-w-md p-0 border-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Reset</DialogTitle>
          </DialogHeader>
          <div className="bg-white px-7 pt-7 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center mb-4 ring-8 ring-yellow-50/40">
                <RotateCw className="w-7 h-7 text-yellow-600" strokeWidth={2.2} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Reset this uploader&apos;s password?</h2>
              <p className="text-sm text-gray-500 max-w-xs">
                A new random password will be generated. Their current mobile app login will stop working immediately.
              </p>
            </div>
            {resetTarget && (
              <div className="mt-5 bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Uploader ID</span>
                  <span className="font-mono font-semibold">{resetTarget.uploaderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold">{resetTarget.name}</span>
                </div>
              </div>
            )}
          </div>
          <div className="px-7 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              onClick={() => setResetTarget(null)}
              disabled={resetBusy}
              className="flex-1 h-11 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              disabled={resetBusy}
              className="flex-1 h-11 rounded-lg bg-[#009846] text-white font-semibold text-sm hover:bg-[#007a38] disabled:opacity-50"
            >
              {resetBusy ? 'Resetting...' : 'Generate New Password'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New credentials reveal */}
      <Dialog open={!!newCreds} onOpenChange={(open) => !open && setNewCreds(null)}>
        <DialogContent className="max-w-lg p-0 border-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>New Credentials</DialogTitle>
          </DialogHeader>
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000] flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider">New Login Credentials</h2>
            <button onClick={() => setNewCreds(null)} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          {newCreds && (
            <div className="p-6 bg-white space-y-4">
              <div className="bg-yellow-50 border border-yellow-300 px-3 py-2 text-xs text-yellow-900">
                Save these credentials now. The password will not be retrievable again.
              </div>
              <div>
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Uploader</div>
                <div className="text-sm font-semibold text-[#06013E]">
                  {newCreds.name} <span className="font-mono text-gray-500">({newCreds.uploaderId})</span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Username</div>
                  <div className="font-mono font-bold text-[#06013E] break-all">{newCreds.username}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 p-3">
                  <div className="text-[10px] font-bold text-gray-500 uppercase">Password</div>
                  <div className="font-mono font-bold text-[#06013E] break-all">{newCreds.password}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={copyAll}
                  className="inline-flex items-center gap-1.5 bg-white border border-gray-400 text-[#06013E] px-4 py-2 text-xs font-semibold hover:bg-gray-100"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy all'}
                </button>
                <button
                  onClick={() => setNewCreds(null)}
                  className="bg-[#009846] text-white px-4 py-2 text-xs font-semibold hover:bg-[#007a38]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
