'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, authFetch } from '@/lib/swr';
import { Loader2, UserX, Clock, Check, X, AlertTriangle } from 'lucide-react';

interface DeletionRequest {
  id: string;
  status: 'PENDING' | 'REJECTED';
  createdAt: string;
  decidedAt: string | null;
  appUserId: string;
  username: string;
  email: string | null;
  mobile: string | null;
  olympiadId: string | null;
  avatarUrl: string | null;
  joinedAt: string;
}

const KEY = '/api/dashboard/account-deletion-requests';

export default function AccountDeletionRequestsPage() {
  const { data, isLoading: loading } = useSWR<DeletionRequest[]>(KEY, fetcher);
  const requests: DeletionRequest[] = Array.isArray(data) ? data : [];

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; action: 'approve' | 'reject'; username: string } | null>(null);

  const pending  = useMemo(() => requests.filter(r => r.status === 'PENDING'), [requests]);
  const decided  = useMemo(() => requests.filter(r => r.status !== 'PENDING'), [requests]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setConfirm(null);
    try {
      const res = await authFetch(`${KEY}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.message || 'Failed to update request');
        return;
      }
      mutate(KEY);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className={confirm.action === 'approve' ? 'text-red-500' : 'text-gray-400'} />
              <h3 className="font-bold text-gray-800">
                {confirm.action === 'approve' ? 'Approve deletion?' : 'Reject request?'}
              </h3>
            </div>
            {confirm.action === 'approve' ? (
              <p className="text-sm text-gray-500">
                This permanently wipes <span className="font-semibold text-gray-700">{confirm.username}</span>&apos;s
                account — profile, videos, likes, follows, everything. This cannot be undone.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{confirm.username}</span> keeps their account as-is.
                They can submit another deletion request later.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirm(null)}
                className="px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100">Cancel</button>
              <button onClick={() => act(confirm.id, confirm.action)}
                className={`px-4 py-2 text-sm font-semibold text-white ${confirm.action === 'approve' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#06013E] hover:bg-[#09025c]'}`}>
                {confirm.action === 'approve' ? 'Delete Permanently' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Account Deletion Requests</h1>
        <p className="text-sm text-gray-400">Student/Olympiad users need approval before their account is wiped — viewers delete themselves automatically after a 30-day grace period and never appear here.</p>
      </div>

      {/* Stats */}
      <div className="flex items-stretch border border-gray-200 bg-white divide-x divide-gray-200">
        <div className="flex items-center gap-3 px-6 py-3">
          <Clock size={17} className="text-amber-600" />
          <span className="text-2xl font-bold text-amber-700">{pending.length}</span>
          <span className="text-sm text-gray-400">Pending Review</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <X size={17} className="text-gray-400" />
          <span className="text-2xl font-bold text-gray-600">{decided.length}</span>
          <span className="text-sm text-gray-400">Rejected (history)</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-600">
            <span className="text-[#004f9f]">{requests.length}</span> requests
          </p>
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[720px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Olympiad ID</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Username</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Email</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Mobile</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Requested On</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f] mb-2" />
                  <p className="text-gray-400 text-sm">Loading...</p>
                </td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400 text-sm">
                  <UserX className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  No deletion requests.
                </td></tr>
              ) : requests.map((r, idx) => (
                <tr key={r.id} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-amber-700">{r.olympiadId || '-'}</td>
                  <td className="px-4 py-2.5 font-mono font-bold text-[#004f9f] text-sm">{r.username}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{r.email || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-gray-500 text-xs">{r.mobile || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === 'PENDING'
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5"><Clock size={10} />Pending</span>
                      : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5"><X size={10} />Rejected</span>
                    }
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === 'PENDING' ? (
                      busyId === r.id ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => setConfirm({ id: r.id, action: 'approve', username: r.username })}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 px-2.5 py-1">
                            <Check size={10} />Approve
                          </button>
                          <button onClick={() => setConfirm({ id: r.id, action: 'reject', username: r.username })}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-2.5 py-1">
                            <X size={10} />Reject
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-gray-300 text-xs">
                        {r.decidedAt && new Date(r.decidedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
