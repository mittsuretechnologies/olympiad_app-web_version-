'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  FileCheck2, Search, Loader2, CheckCircle2, Clock, AlertTriangle, Truck, Eye,
} from 'lucide-react';
import { fetcher } from '@/lib/swr';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface School {
  id: string;
  schoolId?: string;
  olympiadId: string;
  name: string;
  city?: string;
  state?: string;
}

interface ClassCount {
  className: string;
  count: number;
}

interface Receipt {
  id: string;
  receivedAt: string;
  discrepancyNote: string | null;
  classCounts: ClassCount[];
}

interface Dispatch {
  id: string;
  sentAt: string;
  mode: string | null;
  trackingNo: string | null;
  notes: string | null;
  classCounts: ClassCount[];
  receipt: Receipt | null;
}

interface DispatchStatus {
  schoolId: string;
  sentAt: string;
  status: 'AWAITING_CONFIRMATION' | 'DISCREPANCY' | 'CONFIRMED';
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') || '' : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const STATUS_STYLE: Record<DispatchStatus['status'], string> = {
  AWAITING_CONFIRMATION: 'bg-gray-100 text-gray-600 border-gray-300',
  DISCREPANCY: 'bg-orange-100 text-orange-800 border-orange-300',
  CONFIRMED: 'bg-green-100 text-green-800 border-green-300',
};
const STATUS_LABEL: Record<DispatchStatus['status'], string> = {
  AWAITING_CONFIRMATION: 'Awaiting confirmation',
  DISCREPANCY: 'Discrepancy',
  CONFIRMED: 'Confirmed',
};

export default function AnswerSheetDispatchPage() {
  const { data: schoolsData, isLoading: schoolsLoading } = useSWR<School[]>('/api/schools', fetcher);
  const schools: School[] = Array.isArray(schoolsData) ? schoolsData : [];
  const { data: statusData, mutate: mutateStatus } = useSWR<DispatchStatus[]>('/api/schools/answer-sheet-dispatch/status', fetcher);
  const statusBySchool = useMemo(() => {
    const map = new Map<string, DispatchStatus>();
    if (Array.isArray(statusData)) for (const s of statusData) map.set(s.schoolId, s);
    return map;
  }, [statusData]);

  const [searchTerm, setSearchTerm] = useState('');

  const [viewSchool, setViewSchool] = useState<School | null>(null);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [dispatchesLoading, setDispatchesLoading] = useState(false);

  const [receiptModal, setReceiptModal] = useState<Dispatch | null>(null);
  const [receivedAt, setReceivedAt] = useState('');
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [rowCounts, setRowCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredSchools = useMemo(() => {
    if (!searchTerm) return schools;
    const q = searchTerm.toLowerCase();
    return schools.filter(
      (s) => s.name.toLowerCase().includes(q) || s.olympiadId?.toLowerCase().includes(q) || s.schoolId?.toLowerCase().includes(q)
    );
  }, [schools, searchTerm]);

  const loadDispatches = async (school: School) => {
    setDispatchesLoading(true);
    try {
      const res = await fetch(`/api/schools/${school.id}/answer-sheet-dispatch`, { headers: authHeaders() });
      const data = await res.json();
      setDispatches(Array.isArray(data) ? data : []);
    } catch {
      setDispatches([]);
    } finally {
      setDispatchesLoading(false);
    }
  };

  const openViewModal = (school: School) => {
    setViewSchool(school);
    loadDispatches(school);
  };

  const openReceiptModal = (d: Dispatch) => {
    setReceiptModal(d);
    setReceivedAt(d.receipt?.receivedAt.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setDiscrepancyNote(d.receipt?.discrepancyNote || '');
    const initial: Record<string, string> = {};
    for (const c of d.classCounts) {
      const existing = d.receipt?.classCounts.find((rc) => rc.className === c.className);
      initial[c.className] = existing ? String(existing.count) : String(c.count);
    }
    setRowCounts(initial);
    setFormError(null);
  };

  const handleSaveReceipt = async () => {
    if (!receiptModal || !viewSchool) return;
    setFormError(null);
    if (!receivedAt) { setFormError('Received date is required'); return; }

    const classCounts = Object.entries(rowCounts).map(([className, count]) => ({
      className,
      count: parseInt(count, 10) || 0,
    }));

    setSaving(true);
    try {
      const res = await fetch(`/api/schools/answer-sheet-dispatch/${receiptModal.id}/receipt`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ receivedAt, discrepancyNote: discrepancyNote || null, classCounts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save receipt');
      setReceiptModal(null);
      loadDispatches(viewSchool);
      mutateStatus();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-[#004f9f]">Answer Sheet Received</h1>

      <div className="bg-white border border-gray-300 shadow-sm">
        <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Total Schools:</span>
            <span className="font-bold text-[#004f9f]">{schools.length}</span>
          </div>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search by school name, School ID or CRM ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#004f9f]">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300 w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">School ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">CRM ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">School Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Location</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {schoolsLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#004f9f] mb-2" />
                    <p className="text-gray-600 text-sm">Loading schools...</p>
                  </td>
                </tr>
              ) : filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <p className="text-gray-500 text-sm">No schools found.</p>
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s, idx) => (
                  <tr
                    key={s.id}
                    className={`border-b border-gray-200 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-gray-50 hover:bg-yellow-50'}`}
                  >
                    <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">{idx + 1}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#004f9f]">{s.schoolId || '-'}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-gray-600 text-[13px]">{s.olympiadId}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">{s.name}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">{[s.city, s.state].filter(Boolean).join(', ') || '-'}</td>
                    <td className="px-4 py-2.5 border-r border-gray-200">
                      {statusBySchool.has(s.id) ? (
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase border ${STATUS_STYLE[statusBySchool.get(s.id)!.status]}`}>
                          {STATUS_LABEL[statusBySchool.get(s.id)!.status]}
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-red-50 text-red-600 border border-red-200">
                          Not sent yet
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        title="View Answer Sheet Dispatches"
                        onClick={() => openViewModal(s)}
                        className="p-1.5 text-green-700 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing <span className="font-bold">{filteredSchools.length}</span> of <span className="font-bold">{schools.length}</span> schools</span>
          <span className="italic">© mittmee</span>
        </div>
      </div>

      {/* View Dispatches Modal */}
      <Dialog open={!!viewSchool} onOpenChange={(open) => !open && setViewSchool(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-4xl !left-[calc(50%+9rem)] w-[min(92vw,56rem)] max-h-[85vh] overflow-y-auto">
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000] sticky top-0 z-10">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Answer Sheet Dispatches {viewSchool?.schoolId ? `(${viewSchool.schoolId})` : ''}
              </DialogTitle>
            </DialogHeader>
          </div>

          {viewSchool && (
            <div className="p-6 bg-white space-y-5">
              <div className="flex items-center gap-3 border-b-2 border-[#06013E] pb-2 text-[#004f9f]">
                <FileCheck2 className="w-4 h-4" />
                <h3 className="text-sm font-bold uppercase tracking-wider">{viewSchool.name}</h3>
                <span className="text-[11px] font-mono text-gray-400">{viewSchool.olympiadId}</span>
              </div>

              <div className="space-y-3">
                {dispatchesLoading ? (
                  <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f]" /></div>
                ) : dispatches.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">This school hasn&apos;t logged any answer-sheet dispatches yet.</p>
                ) : (
                  dispatches.map((d) => {
                    const totalSent = d.classCounts.reduce((sum, c) => sum + c.count, 0);
                    const totalReceived = d.receipt?.classCounts.reduce((sum, c) => sum + c.count, 0) ?? null;
                    const mismatch = totalReceived !== null && totalReceived !== totalSent;
                    return (
                      <div key={d.id} className="border border-gray-200">
                        <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 border-b border-gray-200">
                          <div className="flex items-center gap-3 text-sm">
                            <Truck className="w-3.5 h-3.5 text-gray-500" />
                            <span className="font-semibold text-gray-900">Sent {fmtDate(d.sentAt)}</span>
                            {d.mode && <span className="text-xs text-gray-500">via {d.mode}</span>}
                            {d.trackingNo && <span className="text-xs font-mono text-gray-400">#{d.trackingNo}</span>}
                          </div>
                          {d.receipt ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase border ${mismatch ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-green-100 text-green-800 border-green-300'}`}>
                              {mismatch ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              {mismatch ? 'Discrepancy' : 'Received'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-300">
                              <Clock className="w-3 h-3" /> Awaiting confirmation
                            </span>
                          )}
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm sm:divide-x sm:divide-gray-200">
                          <div className="sm:max-w-xs sm:pr-4">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Sent by school ({totalSent} total)</p>
                            <ul className="space-y-1">
                              {d.classCounts.map((c) => (
                                <li key={c.className} className="flex justify-between text-gray-700">
                                  <span>{c.className}</span><span className="font-semibold">{c.count}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="sm:max-w-xs sm:pl-4">
                            {d.receipt ? (
                              <>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                                  Received on {fmtDate(d.receipt.receivedAt)} ({totalReceived} total)
                                </p>
                                <ul className="space-y-1">
                                  {d.receipt.classCounts.map((c) => (
                                    <li key={c.className} className="flex justify-between text-gray-700">
                                      <span>{c.className}</span><span className="font-semibold">{c.count}</span>
                                    </li>
                                  ))}
                                </ul>
                                {d.receipt.discrepancyNote && (
                                  <p className="mt-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1.5">
                                    {d.receipt.discrepancyNote}
                                  </p>
                                )}
                              </>
                            ) : (
                              <div className="flex h-full min-h-[64px] items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-center">
                                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                                  <Clock className="w-3.5 h-3.5" /> Not confirmed yet
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end border-t border-gray-100 px-4 py-2.5">
                          <button
                            onClick={() => openReceiptModal(d)}
                            className="inline-flex items-center gap-1.5 bg-[#009846] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#007a38] transition-colors"
                          >
                            {d.receipt ? 'Update receipt' : 'Confirm receipt'}
                          </button>
                        </div>
                        {d.notes && (
                          <div className="px-4 pb-3 text-xs text-gray-500 border-t border-gray-100 pt-2">Note: {d.notes}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Receipt Modal */}
      <Dialog open={!!receiptModal} onOpenChange={(open) => !open && setReceiptModal(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-md !left-[calc(50%+9rem)] w-[min(90vw,28rem)]">
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Confirm Receipt {receiptModal ? `— ${fmtDate(receiptModal.sentAt)}` : ''}
              </DialogTitle>
            </DialogHeader>
          </div>

          {receiptModal && (
            <div className="p-6 bg-white space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">Received Date</label>
                <input
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  className="w-full h-9 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">Class-wise count actually received</label>
                <div className="space-y-2 border border-gray-200 p-3">
                  {receiptModal.classCounts.map((c) => (
                    <div key={c.className} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700">{c.className} <span className="text-gray-400">(sent {c.count})</span></span>
                      <input
                        type="number"
                        min={0}
                        value={rowCounts[c.className] ?? ''}
                        onChange={(e) => setRowCounts((prev) => ({ ...prev, [c.className]: e.target.value }))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-20 h-8 border border-gray-300 px-2 text-sm text-right focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">Discrepancy note (if any)</label>
                <textarea
                  value={discrepancyNote}
                  onChange={(e) => setDiscrepancyNote(e.target.value)}
                  placeholder="e.g. 3 sheets missing for Class 2"
                  className="w-full min-h-[60px] border border-gray-300 p-2 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                />
              </div>

              {formError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{formError}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setReceiptModal(null)}
                  disabled={saving}
                  className="h-9 px-4 bg-white border border-gray-400 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveReceipt}
                  disabled={saving}
                  className="h-9 px-5 bg-[#009846] text-white font-semibold text-xs hover:bg-[#007a38] transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
