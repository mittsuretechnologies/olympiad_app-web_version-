'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  Package, Search, Loader2, Plus, Trash, CheckCircle2, Clock, AlertTriangle, Eye,
} from 'lucide-react';
import { fetcher } from '@/lib/swr';
import { CLASSES } from '@/lib/classes';
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

const MODES = ['Courier', 'Speed Post', 'Hand Delivery', 'Other'];

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

export default function PaperDispatchPage() {
  const { data: schoolsData, isLoading: schoolsLoading } = useSWR<School[]>('/api/schools', fetcher);
  const schools: School[] = Array.isArray(schoolsData) ? schoolsData : [];
  const { data: statusData, mutate: mutateStatus } = useSWR<DispatchStatus[]>('/api/schools/paper-dispatch/status', fetcher);
  const statusBySchool = useMemo(() => {
    const map = new Map<string, DispatchStatus>();
    if (Array.isArray(statusData)) for (const s of statusData) map.set(s.schoolId, s);
    return map;
  }, [statusData]);

  const [searchTerm, setSearchTerm] = useState('');

  const [viewSchool, setViewSchool] = useState<School | null>(null);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [dispatchesLoading, setDispatchesLoading] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [showRedispatchWarning, setShowRedispatchWarning] = useState(false);
  const [sentAt, setSentAt] = useState('');
  const [mode, setMode] = useState('Courier');
  const [trackingNo, setTrackingNo] = useState('');
  const [notes, setNotes] = useState('');
  const [classRows, setClassRows] = useState<{ className: string; count: string }[]>([{ className: '', count: '' }]);
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
      const res = await fetch(`/api/schools/${school.id}/paper-dispatch`, { headers: authHeaders() });
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
    setShowAddForm(false);
    setShowRedispatchWarning(false);
    setFormError(null);
    loadDispatches(school);
  };

  const openAddForm = () => {
    setSentAt(new Date().toISOString().slice(0, 10));
    setMode('Courier');
    setTrackingNo('');
    setNotes('');
    setClassRows([{ className: '', count: '' }]);
    setFormError(null);
    setShowAddForm(true);
  };

  // A school with at least one dispatch already on file gets a confirm step
  // before opening the form again, so a duplicate dispatch is a deliberate
  // choice rather than an accidental double-click.
  const handleLogDispatchClick = () => {
    if (dispatches.length > 0) {
      setShowRedispatchWarning(true);
    } else {
      openAddForm();
    }
  };

  const handleAddDispatch = async () => {
    if (!viewSchool) return;
    setFormError(null);
    if (!sentAt) { setFormError('Sent date is required'); return; }
    const rows = classRows.filter((r) => r.className.trim());
    if (rows.length === 0) { setFormError('Add at least one class with a count'); return; }
    for (const r of rows) {
      const c = parseInt(r.count, 10);
      if (!c || c < 1) { setFormError(`Enter a valid count for ${r.className}`); return; }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/schools/${viewSchool.id}/paper-dispatch`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          sentAt,
          mode,
          trackingNo: trackingNo || null,
          notes: notes || null,
          classCounts: rows.map((r) => ({ className: r.className.trim(), count: parseInt(r.count, 10) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to log dispatch');
      setShowAddForm(false);
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
      <h1 className="text-2xl font-medium text-[#004f9f]">Question Paper Dispatch</h1>

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
                        title="View & Log Dispatch"
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

      {/* View & Log Dispatch Modal */}
      <Dialog open={!!viewSchool} onOpenChange={(open) => !open && setViewSchool(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-4xl !left-[calc(50%+9rem)] w-[min(92vw,56rem)] max-h-[85vh] overflow-y-auto">
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000] sticky top-0 z-10">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Question Paper Dispatch {viewSchool?.schoolId ? `(${viewSchool.schoolId})` : ''}
              </DialogTitle>
            </DialogHeader>
          </div>

          {viewSchool && (
            <div className="p-6 bg-white space-y-5">
              <div className="flex items-center justify-between border-b-2 border-[#06013E] pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-[#004f9f]">
                  <Package className="w-4 h-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">{viewSchool.name}</h3>
                  <span className="text-[11px] font-mono text-gray-400">{viewSchool.olympiadId}</span>
                </div>
                {!showAddForm && !showRedispatchWarning && (
                  <button
                    onClick={handleLogDispatchClick}
                    className="inline-flex items-center gap-1.5 bg-[#009846] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#007a38] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Dispatch
                  </button>
                )}
              </div>

              {showRedispatchWarning && (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-orange-300 bg-orange-50 px-4 py-3">
                  <p className="text-sm text-orange-800">
                    Question papers have already been dispatched to this school. Do you still want to log another dispatch?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowRedispatchWarning(false)}
                      className="h-8 px-3 bg-white border border-gray-400 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors"
                    >
                      No
                    </button>
                    <button
                      onClick={() => { setShowRedispatchWarning(false); openAddForm(); }}
                      className="h-8 px-3 bg-orange-600 text-white font-semibold text-xs hover:bg-orange-700 transition-colors"
                    >
                      Yes, log another
                    </button>
                  </div>
                </div>
              )}

              {showAddForm && (
                <div className="bg-blue-50 border border-blue-200 p-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">Sent Date <span className="text-red-600">*</span></label>
                      <input
                        type="date"
                        value={sentAt}
                        onChange={(e) => setSentAt(e.target.value)}
                        className="w-full h-9 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">Mode</label>
                      <select
                        value={mode}
                        onChange={(e) => setMode(e.target.value)}
                        className="w-full h-9 border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                      >
                        {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">Tracking No.</label>
                      <input
                        type="text"
                        value={trackingNo}
                        onChange={(e) => setTrackingNo(e.target.value)}
                        placeholder="Optional"
                        className="w-full h-9 border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">Class-wise Count <span className="text-red-600">*</span></label>
                    <div className="space-y-2">
                      {classRows.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={row.className}
                            onChange={(e) => setClassRows((prev) => prev.map((r, i) => i === idx ? { ...r, className: e.target.value } : r))}
                            className="col-span-6 h-9 border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                          >
                            <option value="">Select class</option>
                            {CLASSES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={row.count}
                            onChange={(e) => setClassRows((prev) => prev.map((r, i) => i === idx ? { ...r, count: e.target.value } : r))}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="Count"
                            className="col-span-4 h-9 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                          />
                          <button
                            type="button"
                            onClick={() => setClassRows((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                            disabled={classRows.length === 1}
                            className="col-span-2 h-9 flex items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-30"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setClassRows((prev) => [...prev, { className: '', count: '' }])}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#004f9f] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add another class
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full min-h-[60px] border border-gray-300 p-2 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                      placeholder="Optional"
                    />
                  </div>

                  {formError && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">{formError}</div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      disabled={saving}
                      className="h-9 px-4 bg-white border border-gray-400 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddDispatch}
                      disabled={saving}
                      className="h-9 px-5 bg-[#009846] text-white font-semibold text-xs hover:bg-[#007a38] transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Log Dispatch'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {dispatchesLoading ? (
                  <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f]" /></div>
                ) : dispatches.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-500">No dispatches logged yet for this school.</p>
                ) : (
                  dispatches.map((d) => {
                    const totalSent = d.classCounts.reduce((sum, c) => sum + c.count, 0);
                    const totalReceived = d.receipt?.classCounts.reduce((sum, c) => sum + c.count, 0) ?? null;
                    const mismatch = totalReceived !== null && totalReceived !== totalSent;
                    return (
                      <div key={d.id} className="border border-gray-200">
                        <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 border-b border-gray-200">
                          <div className="flex items-center gap-3 text-sm">
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
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">Sent ({totalSent} total)</p>
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
                                  <Clock className="w-3.5 h-3.5" /> Awaiting the school&apos;s confirmation
                                </p>
                              </div>
                            )}
                          </div>
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
    </div>
  );
}
