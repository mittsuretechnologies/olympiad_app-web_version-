'use client';

import { useEffect, useState } from 'react';
import { Package, Loader2, CheckCircle2, Clock, AlertTriangle, Truck } from 'lucide-react';
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

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function SchoolPaperDispatchPage() {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [receiptModal, setReceiptModal] = useState<Dispatch | null>(null);
  const [receivedAt, setReceivedAt] = useState('');
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [rowCounts, setRowCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') : '';

  const load = () => {
    setLoading(true);
    fetch('/api/school/me/paper-dispatch', { headers: { Authorization: `Bearer ${token}` } })
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
  }, []);

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
    if (!receiptModal) return;
    setFormError(null);
    if (!receivedAt) { setFormError('Received date is required'); return; }

    const classCounts = Object.entries(rowCounts).map(([className, count]) => ({
      className,
      count: parseInt(count, 10) || 0,
    }));

    setSaving(true);
    try {
      const res = await fetch(`/api/school/me/paper-dispatch/${receiptModal.id}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receivedAt, discrepancyNote: discrepancyNote || null, classCounts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save receipt');
      setReceiptModal(null);
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
        icon={Package}
        title="Question Papers"
        subtitle="Track question-paper shipments sent by the Olympiad admin and confirm what you received"
      />

      {loading ? (
        <LoadingState label="Loading dispatch records…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : dispatches.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No dispatches yet"
          hint="Once the Olympiad admin sends question papers to your school, they'll appear here."
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
                      <Clock size={12} /> Awaiting confirmation
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
                          <Clock size={13} /> Not confirmed yet — tap below to log what arrived
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end border-t border-[#E4E8EE] px-4 py-2.5">
                  <button onClick={() => openReceiptModal(d)} className={BTN_PRIMARY}>
                    {d.receipt ? 'Update receipt' : 'Confirm receipt'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {receiptModal && (
        <ModalShell
          eyebrow="Confirm receipt"
          title={`Papers sent ${fmtDate(receiptModal.sentAt)}`}
          onClose={() => setReceiptModal(null)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 p-5">
            <div>
              <label className={LABEL}>Received date</label>
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className={INPUT}
              />
            </div>

            <div>
              <label className={LABEL}>Class-wise count actually received</label>
              <div className="space-y-2 rounded-lg border border-[#E4E8EE] p-3">
                {receiptModal.classCounts.map((c) => (
                  <div key={c.className} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-[#374151]">{c.className} <span className="text-[#9CA3AF]">(sent {c.count})</span></span>
                    <input
                      type="number"
                      min={0}
                      value={rowCounts[c.className] ?? ''}
                      onChange={(e) => setRowCounts((prev) => ({ ...prev, [c.className]: e.target.value }))}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-20 rounded-md border border-[#D1D5DB] px-2 py-1 text-[13px] text-right focus:border-[#1559C7] focus:outline-none focus:ring-1 focus:ring-[#1559C7]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={LABEL}>Discrepancy note (if any)</label>
              <textarea
                value={discrepancyNote}
                onChange={(e) => setDiscrepancyNote(e.target.value)}
                placeholder="e.g. 2 UKG papers arrived damaged"
                className={`${INPUT} min-h-[70px]`}
              />
            </div>

            {formError && <p className="text-[12px] text-[#B91C1C]">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={() => setReceiptModal(null)} disabled={saving} className={`${BTN_SECONDARY} flex-1`}>Cancel</button>
              <button onClick={handleSaveReceipt} disabled={saving} className={`${BTN_PRIMARY} flex-1`}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
