'use client';

import { useMemo, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { fetcher, authFetch } from '@/lib/swr';
import { Loader2, CalendarClock, Clock, Check, X, AlertTriangle, Lock } from 'lucide-react';

interface ExamDateRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  previousDate: string | null;
  requestedDate: string;
  reason: string | null;
  remark: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
  schoolRefId: string;
  schoolId: string;
  olympiadId: string;
  schoolName: string;
  district: string | null;
  state: string | null;
  currentExamDate: string | null;
  attendanceSubmittedAt: string | null;
}

const KEY = '/api/dashboard/exam-date-requests';

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

export default function ExamDateRequestsPage() {
  const { data, isLoading: loading } = useSWR<ExamDateRequest[]>(KEY, fetcher);
  const requests: ExamDateRequest[] = Array.isArray(data) ? data : [];

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ req: ExamDateRequest; action: 'approve' | 'reject' } | null>(null);
  const [remark, setRemark] = useState('');
  const [dialogError, setDialogError] = useState('');

  const pending  = useMemo(() => requests.filter(r => r.status === 'PENDING'), [requests]);
  const approved = useMemo(() => requests.filter(r => r.status === 'APPROVED'), [requests]);
  const rejected = useMemo(() => requests.filter(r => r.status === 'REJECTED'), [requests]);

  const openConfirm = (req: ExamDateRequest, action: 'approve' | 'reject') => {
    setRemark('');
    setDialogError('');
    setConfirm({ req, action });
  };

  const act = async () => {
    if (!confirm) return;
    const { req, action } = confirm;
    if (action === 'reject' && !remark.trim()) {
      setDialogError('Please add a remark — the school will see it.');
      return;
    }
    setBusyId(req.id);
    setConfirm(null);
    try {
      const res = await authFetch(`${KEY}/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, remark: remark.trim() || undefined }),
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
          <div className="bg-white max-w-md w-full p-5 space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className={confirm.action === 'approve' ? 'text-[#009846]' : 'text-gray-400'} />
              <h3 className="font-bold text-gray-800">
                {confirm.action === 'approve' ? 'Approve exam date change?' : 'Decline request?'}
              </h3>
            </div>
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-700">{confirm.req.schoolName}</span>
              {' '}({confirm.req.schoolId}):{' '}
              {fmt(confirm.req.currentExamDate) ?? 'no date set'} →{' '}
              <span className="font-semibold text-gray-700">{fmt(confirm.req.requestedDate)}</span>
            </p>
            {confirm.action === 'approve' ? (
              <p className="text-sm text-gray-500">The school&apos;s exam date will be updated right away.</p>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Remark for the school *</label>
                <textarea
                  value={remark}
                  onChange={e => { setRemark(e.target.value); setDialogError(''); }}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Exam slots on this date are full — please pick 1 Dec."
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[#004f9f]"
                />
                {dialogError && <p className="text-xs text-red-600 mt-1">{dialogError}</p>}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirm(null)}
                className="px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100">Cancel</button>
              <button onClick={act}
                className={`px-4 py-2 text-sm font-semibold text-white ${confirm.action === 'approve' ? 'bg-[#009846] hover:bg-[#007a38]' : 'bg-[#06013E] hover:bg-[#09025c]'}`}>
                {confirm.action === 'approve' ? 'Approve' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Exam Date Requests</h1>
        <p className="text-sm text-gray-400">Schools can&apos;t change their exam date themselves — each change they ask for waits here for approval. Declined requests show your remark to the school.</p>
      </div>

      {/* Stats */}
      <div className="flex items-stretch border border-gray-200 bg-white divide-x divide-gray-200">
        <div className="flex items-center gap-3 px-6 py-3">
          <Clock size={17} className="text-amber-600" />
          <span className="text-2xl font-bold text-amber-700">{pending.length}</span>
          <span className="text-sm text-gray-400">Pending</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <Check size={17} className="text-[#009846]" />
          <span className="text-2xl font-bold text-[#009846]">{approved.length}</span>
          <span className="text-sm text-gray-400">Approved</span>
        </div>
        <div className="flex items-center gap-3 px-6 py-3">
          <X size={17} className="text-gray-400" />
          <span className="text-2xl font-bold text-gray-600">{rejected.length}</span>
          <span className="text-sm text-gray-400">Declined</span>
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
          <table className="w-full text-sm border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Current Date</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Requested Date</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">School&apos;s Reason</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Requested On</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider">Action / Remark</th>
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
                  <CalendarClock className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                  No exam date requests.
                </td></tr>
              ) : requests.map((r, idx) => (
                <tr key={r.id} className={`border-b border-gray-100 align-top hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-gray-800">{r.schoolName}</p>
                    <p className="font-mono text-xs text-[#004f9f]">{r.schoolId} · {r.olympiadId}</p>
                    {(r.district || r.state) && (
                      <p className="text-xs text-gray-400">{[r.district, r.state].filter(Boolean).join(', ')}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {/* While pending, show what's live on the school now; once decided, what it was at request time. */}
                    {(r.status === 'PENDING' ? fmt(r.currentExamDate) : fmt(r.previousDate)) ?? <span className="text-gray-300">Not set</span>}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-800 text-xs whitespace-nowrap">{fmt(r.requestedDate)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[220px] break-words">{r.reason || <span className="text-gray-300">-</span>}</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    {r.status === 'PENDING' && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5"><Clock size={10} />Pending</span>}
                    {r.status === 'APPROVED' && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#009846] bg-green-50 border border-green-200 px-2 py-0.5"><Check size={10} />Approved</span>}
                    {r.status === 'REJECTED' && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5"><X size={10} />Declined</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === 'PENDING' ? (
                      busyId === r.id ? (
                        <Loader2 size={14} className="animate-spin text-gray-400" />
                      ) : (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openConfirm(r, 'approve')} disabled={Boolean(r.attendanceSubmittedAt)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-[#009846] hover:bg-[#007a38] disabled:opacity-40 disabled:cursor-not-allowed px-2.5 py-1">
                              <Check size={10} />Approve
                            </button>
                            <button onClick={() => openConfirm(r, 'reject')}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-2.5 py-1">
                              <X size={10} />Decline
                            </button>
                          </div>
                          {r.attendanceSubmittedAt && (
                            <p className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                              <Lock size={10} /> Attendance already submitted
                            </p>
                          )}
                        </div>
                      )
                    ) : (
                      <div className="text-xs max-w-[240px]">
                        {r.remark && <p className="text-gray-600 break-words">&ldquo;{r.remark}&rdquo;</p>}
                        <p className="text-gray-300">
                          {[r.decidedByName, fmt(r.decidedAt)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
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
