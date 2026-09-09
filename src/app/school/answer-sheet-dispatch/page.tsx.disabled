'use client';

import { useEffect, useState } from 'react';
import { FileCheck2, Loader2, Plus, Trash, CheckCircle2, Clock, AlertTriangle, Truck } from 'lucide-react';
import { CLASSES } from '@/lib/classes';
import { CARD, STACK, BTN_PRIMARY, BTN_SECONDARY, LABEL, INPUT } from '../ui';
import { PageHeader, LoadingState, ErrorState, EmptyState, ModalShell } from '../components';

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

// Shape of a question-paper dispatch as returned by /api/school/me/paper-dispatch —
// only the receipt's class counts are needed here (how many papers the school
// itself confirmed receiving), to give a "papers you have on hand" reference
// when logging the answer sheets going back.
interface QuestionPaperDispatch {
  receipt: { classCounts: ClassCount[] } | null;
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const MODES = ['Courier', 'Speed Post', 'Hand Delivery', 'Other'];

export default function SchoolAnswerSheetDispatchPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [papersReceived, setPapersReceived] = useState<ClassCount[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRedispatchWarning, setShowRedispatchWarning] = useState(false);
  const [sentAt, setSentAt] = useState('');
  const [mode, setMode] = useState('Courier');
  const [trackingNo, setTrackingNo] = useState('');
  const [notes, setNotes] = useState('');
  const [classRows, setClassRows] = useState<{ className: string; count: string }[]>([{ className: '', count: '' }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') : '';

  const load = () => {
    setLoading(true);
    fetch('/api/school/me/answer-sheet-dispatch', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setDispatches(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) { setError('Not logged in'); setLoading(false); return; }
    load();

    // Best-effort: pull the school's own confirmed question-paper receipts so
    // the dispatch form can show "papers you have on hand" for reference.
    fetch('/api/school/me/paper-dispatch', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data: QuestionPaperDispatch[]) => {
        if (!Array.isArray(data)) return;
        const totals = new Map<string, number>();
        for (const d of data) {
          if (!d.receipt) continue;
          for (const c of d.receipt.classCounts) {
            totals.set(c.className, (totals.get(c.className) || 0) + c.count);
          }
        }
        setPapersReceived(Array.from(totals.entries()).map(([className, count]) => ({ className, count })));
      })
      .catch(() => setPapersReceived([]));
  }, []);

  const openAddModal = () => {
    setSentAt(new Date().toISOString().slice(0, 10));
    setMode('Courier');
    setTrackingNo('');
    setNotes('');
    // Pre-fill class names from papers received (shown above for reference)
    // so the school doesn't reselect them, but leave counts blank — the
    // school types the actual answer-sheet count fresh rather than editing
    // down a pre-filled number that duplicates what's already on screen.
    setClassRows(
      papersReceived.length > 0
        ? papersReceived.map((c) => ({ className: c.className, count: '' }))
        : [{ className: '', count: '' }]
    );
    setFormError(null);
    setShowAddModal(true);
  };

  // A school with at least one answer-sheet dispatch already on file gets a
  // confirm step before opening the form again, so a duplicate dispatch is
  // a deliberate choice rather than an accidental double-click.
  const handleLogDispatchClick = () => {
    if (dispatches.length > 0) {
      setShowRedispatchWarning(true);
    } else {
      openAddModal();
    }
  };

  const handleAddDispatch = async () => {
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
      const res = await fetch('/api/school/me/answer-sheet-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      setShowAddModal(false);
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={STACK}>
      <PageHeader
        icon={FileCheck2}
        title="Answer Sheets"
        subtitle="Log the answer sheets you send back after conducting the exam"
        actions={
          <button onClick={handleLogDispatchClick} className={BTN_PRIMARY}>
            <Plus size={14} /> Log Dispatch
          </button>
        }
      />

      {showRedispatchWarning && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <p className="text-[13px] text-[#92400E]">
            Answer sheets have already been dispatched. Do you still want to log another dispatch?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowRedispatchWarning(false)}
              className={BTN_SECONDARY}
            >
              No
            </button>
            <button
              onClick={() => { setShowRedispatchWarning(false); openAddModal(); }}
              className="cursor-pointer rounded-lg bg-[#D97706] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#B45309]"
            >
              Yes, log another
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading dispatch records…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : dispatches.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No dispatches yet"
          hint="After conducting the exam, log here what answer sheets you're sending back and when."
        />
      ) : (
        <div className="space-y-3">
          {dispatches.map((d) => {
            const totalSent = d.classCounts.reduce((sum, c) => sum + c.count, 0);
            const totalReceived = d.receipt?.classCounts.reduce((sum, c) => sum + c.count, 0) ?? null;
            const mismatch = totalReceived !== null && totalReceived !== totalSent;
            return (
              <div key={d.id} className={`${CARD} overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E8EE] bg-[#FAFBFC] px-4 py-3">
                  <div className="flex items-center gap-2 text-[13px]">
                    <Truck size={14} className="text-[#6B7280]" />
                    <span className="font-semibold text-black">Sent {fmtDate(d.sentAt)}</span>
                    {d.mode && <span className="text-[#6B7280]">via {d.mode}</span>}
                    {d.trackingNo && <span className="font-mono text-[11px] text-[#9CA3AF]">#{d.trackingNo}</span>}
                  </div>
                  {d.receipt ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${mismatch ? 'bg-[#FFFBEB] text-[#92400E]' : 'bg-[#E9F7F0] text-[#047857]'}`}>
                      {mismatch ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                      {mismatch ? 'Discrepancy noted' : 'Confirmed received'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-semibold text-[#6B7280]">
                      <Clock size={12} /> Awaiting admin confirmation
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:divide-x sm:divide-[#E4E8EE]">
                  <div className="sm:max-w-xs sm:pr-4">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Sent ({totalSent} total)</p>
                    <ul className="space-y-1 text-[13px]">
                      {d.classCounts.map((c) => (
                        <li key={c.className} className="flex justify-between text-[#374151]">
                          <span>{c.className}</span><span className="font-semibold text-black">{c.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="sm:max-w-xs sm:pl-4">
                    {d.receipt ? (
                      <>
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                          Received on {fmtDate(d.receipt.receivedAt)} ({totalReceived} total)
                        </p>
                        <ul className="space-y-1 text-[13px]">
                          {d.receipt.classCounts.map((c) => (
                            <li key={c.className} className="flex justify-between text-[#374151]">
                              <span>{c.className}</span><span className="font-semibold text-black">{c.count}</span>
                            </li>
                          ))}
                        </ul>
                        {d.receipt.discrepancyNote && (
                          <p className="mt-2 rounded-md bg-[#FFFBEB] px-2.5 py-1.5 text-[12px] text-[#92400E]">{d.receipt.discrepancyNote}</p>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full min-h-[64px] items-center justify-center rounded-lg border border-dashed border-[#D1D5DB] bg-[#FAFBFC] px-3 py-4 text-center">
                        <p className="flex items-center gap-1.5 text-[12.5px] text-[#9CA3AF]">
                          <Clock size={13} /> Awaiting the Olympiad admin&apos;s confirmation
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {d.notes && (
                  <div className="border-t border-[#E4E8EE] px-4 py-2 text-[12px] text-[#6B7280]">Note: {d.notes}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dispatch Modal */}
      {showAddModal && (
        <ModalShell
          eyebrow="Log dispatch"
          title="Send answer sheets"
          onClose={() => setShowAddModal(false)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 p-5">
            {papersReceived.length > 0 && (
              <div className="rounded-lg border border-[#C9E9DA] bg-[#E9F7F0] p-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#065F46]">
                  Question papers you received
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[#065F46]">
                  {papersReceived.map((c) => (
                    <li key={c.className}>{c.className}: <span className="font-semibold">{c.count}</span></li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Sent date</label>
                <input type="date" value={sentAt} onChange={(e) => setSentAt(e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className={INPUT}>
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Tracking No.</label>
                <input
                  type="text"
                  value={trackingNo}
                  onChange={(e) => setTrackingNo(e.target.value)}
                  placeholder="Optional"
                  className={`${INPUT} font-mono`}
                />
              </div>
            </div>

            <div>
              <label className={LABEL}>Class-wise count</label>
              <div className="space-y-2 rounded-lg border border-[#E4E8EE] p-3">
                {classRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={row.className}
                      onChange={(e) => setClassRows((prev) => prev.map((r, i) => i === idx ? { ...r, className: e.target.value } : r))}
                      className="flex-1 rounded-md border border-[#D1D5DB] px-2 py-1.5 text-[13px] focus:border-[#1559C7] focus:outline-none focus:ring-1 focus:ring-[#1559C7]"
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
                      className="w-24 rounded-md border border-[#D1D5DB] px-2 py-1.5 text-[13px] focus:border-[#1559C7] focus:outline-none focus:ring-1 focus:ring-[#1559C7]"
                    />
                    <button
                      type="button"
                      onClick={() => setClassRows((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)}
                      disabled={classRows.length === 1}
                      className="p-1.5 text-[#B91C1C] hover:bg-[#FDECEC] disabled:opacity-30"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setClassRows((prev) => [...prev, { className: '', count: '' }])}
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1559C7] hover:underline"
              >
                <Plus size={13} /> Add another class
              </button>
            </div>

            <div>
              <label className={LABEL}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className={`${INPUT} min-h-[60px]`} />
            </div>

            {formError && <p className="text-[12px] text-[#B91C1C]">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowAddModal(false)} disabled={saving} className={`${BTN_SECONDARY} flex-1`}>Cancel</button>
              <button onClick={handleAddDispatch} disabled={saving} className={`${BTN_PRIMARY} flex-1`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Log Dispatch'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
