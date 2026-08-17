'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Users, Loader2, Search, Download, BookOpen, Calendar, Phone,
  Mail, CheckCircle2, Send, AlertCircle, ChevronDown, ChevronUp,
  KeyRound, Eye, EyeOff,
} from 'lucide-react';
import {
  CARD, STACK, TABLE, TH, TD, TR, INPUT, LABEL,
  BTN_PRIMARY, BTN_SECONDARY, BTN_SUBTLE, avatarTint,
} from '../ui';
import {
  PageHeader, StatTile, FilterPill, Avatar,
  LoadingState, ErrorState, EmptyState, ModalShell, RowCount,
} from '../components';

interface Student {
  id: string;
  name: string;
  phone: string;
  olympiadCode: string;
  isVerified: boolean;
  createdAt: string;
  classCode: string | null;
  className: string | null;
  source?: 'web' | 'app';
  olympiadVideos?: number;
  email?: string | null;
  username?: string | null;
  password?: string | null;
}

/** Expandable profile shown under a student's row: contact, and — for
 *  app-registered students only — login credentials. Olympiad submission
 *  status (slots A/B) lives on its own page rather than here. */
function StudentProfile({ s, onSendCredentials }: { s: Student; onSendCredentials: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 gap-3 bg-[#FAFBFC] p-4 sm:grid-cols-2">
      <div className="rounded-lg border border-[#C9E9DA] bg-[#E9F7F0] p-3.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Contact</p>
        <dl className="space-y-1.5 text-[12.5px]">
          <div className="flex items-center gap-2">
            <Phone size={12} className="flex-shrink-0 text-[#9CA3AF]" />
            <span className="font-mono text-black">{s.phone}</span>
          </div>
          {s.email && (
            <div className="flex items-center gap-2">
              <Mail size={12} className="flex-shrink-0 text-[#9CA3AF]" />
              <span className="truncate text-black">{s.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar size={12} className="flex-shrink-0 text-[#9CA3AF]" />
            <span className="text-black">Joined {fmtDate(s.createdAt)}</span>
          </div>
        </dl>
      </div>

      {s.source === 'app' && (
        <div className="rounded-lg border border-[#E1DAF7] bg-[#F1EEFB] p-3.5">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
            <KeyRound size={11} /> Login credentials
          </p>
          <dl className="space-y-1.5 text-[12.5px]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-black">Username</dt>
              <dd className="select-all font-mono font-semibold text-[#1559C7]">{s.username || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-black">Password</dt>
              <dd className="flex items-center gap-1.5">
                {s.password ? (
                  <>
                    <span className="select-all font-mono font-semibold text-black">
                      {showPassword ? s.password : '••••••••'}
                    </span>
                    <button
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="text-[#9CA3AF] hover:text-[#4B5563]"
                    >
                      {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </>
                ) : (
                  <span className="text-[#9CA3AF]">App login</span>
                )}
              </dd>
            </div>
          </dl>
          <button
            onClick={onSendCredentials}
            className="cursor-pointer mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#7C6FCB] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#5B4FA3] transition-colors hover:bg-[#6D5FBD] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6FCB]/40"
          >
            <Send size={13} /> Email credentials
          </button>
        </div>
      )}
    </div>
  );
}

export default function SchoolRegisteredStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Send credentials modal
  const [sendModal, setSendModal] = useState<Student | null>(null);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') : '';

  useEffect(() => {
    if (!token) { setError('Not logged in'); setLoading(false); return; }

    fetch('/api/school/me/registered-students', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setStudents(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const openSendModal = (s: Student) => {
    setSendModal(s);
    setSendEmail(s.email || '');
    setSendError('');
    setSendSuccess(null);
  };
  const closeSendModal = () => {
    setSendModal(null); setSendEmail(''); setSendError(''); setSendSuccess(null);
  };

  const handleSendCredentials = async () => {
    if (!sendModal) return;
    if (sendEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendEmail.trim())) {
      setSendError('Enter a valid email address'); return;
    }
    if (!sendEmail.trim()) { setSendError('Email address is required'); return; }
    setSending(true); setSendError('');
    try {
      const res = await fetch(`/api/school/me/olympiad-ids/${sendModal.olympiadCode}/send-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: sendEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send credentials');
      setSendSuccess(data.email);
      setStudents(prev => prev.map(s => s.id === sendModal.id ? { ...s, email: data.email } : s));
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      const key = s.classCode || 'UNKNOWN';
      map.set(key, s.className || s.classCode || 'Unknown');
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (classFilter !== 'ALL' && (s.classCode || 'UNKNOWN') !== classFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !s.name.toLowerCase().includes(q) &&
          !s.olympiadCode.toLowerCase().includes(q) &&
          !s.phone.includes(q)
        ) return false;
      }
      return true;
    });
  }, [students, search, classFilter]);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const rows = [
      ['#', 'Student Name', 'Olympiad ID', 'Class', 'Phone', 'Registration Date'],
      ...filtered.map((s, i) => [
        i + 1, s.name, s.olympiadCode,
        s.className || s.classCode || '-',
        s.phone,
        new Date(s.createdAt).toLocaleDateString('en-IN'),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `students-${classFilter === 'ALL' ? 'all' : classFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className={STACK}>

      <PageHeader
        icon={Users}
        title="My Students"
        subtitle="Full profile, olympiad status and credentials per student"
        actions={
          <button onClick={exportCSV} disabled={filtered.length === 0} className={BTN_SUBTLE}>
            <Download size={13} /> Export
          </button>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Total students" value={students.length} icon={Users} loading={loading} />
        <StatTile label="Classes" value={classes.length} icon={BookOpen} loading={loading} />
      </div>

      {/* Toolbar */}
      <div className={`${CARD} flex flex-wrap items-center gap-2 px-3 py-2.5`}>
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={13} />
          <input
            type="text"
            placeholder="Search by name, ID or phone"
            aria-label="Search students"
            className={`${INPUT} pl-8`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {classes.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill active={classFilter === 'ALL'} onClick={() => setClassFilter('ALL')}>
              All classes
            </FilterPill>
            {classes.map(cls => (
              <FilterPill key={cls.code} active={classFilter === cls.code} onClick={() => setClassFilter(cls.code)}>
                {cls.name}
                <span className="ml-1 opacity-60">
                  {students.filter(s => (s.classCode || 'UNKNOWN') === cls.code).length}
                </span>
              </FilterPill>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingState label="Loading student records…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={students.length === 0 ? 'No students yet' : 'No students match your filters'}
          hint={students.length === 0 ? 'Allot Olympiad IDs to get students registered.' : undefined}
        />
      ) : (
        <div className={`${CARD} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={`${TH} w-12`}>#</th>
                  <th className={`${TH} w-36`}>Olympiad ID</th>
                  <th className={`${TH} w-48`}>Student name</th>
                  <th className={`${TH} w-28`}>Class</th>
                  <th className={`${TH} w-32`}>Phone</th>
                  <th className={`${TH} w-28`}>Joined on</th>
                  <th className={`${TH} w-12`} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const isOpen = expandedId === s.id;
                  return (
                    <Fragment key={s.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : s.id)}
                        className={`${TR} cursor-pointer ${isOpen ? 'bg-[#1559C7]/[0.03]' : ''}`}
                      >
                        <td className={`${TD} text-[#9CA3AF]`}>{i + 1}</td>
                        <td className={`${TD} font-mono font-semibold text-[#1559C7]`}>{s.olympiadCode}</td>
                        <td className={TD}>
                          <span className="flex items-center gap-2">
                            <Avatar name={s.name} tint={avatarTint(i)} size={26} />
                            <span className="font-medium text-black">{s.name}</span>
                          </span>
                        </td>
                        <td className={`${TD} font-medium text-black`}>{s.className || s.classCode || <span className="font-normal text-[#9CA3AF]">—</span>}</td>
                        <td className={`${TD} font-mono font-medium text-black`}>{s.phone}</td>
                        <td className={`${TD} text-[#6B7280]`}>{fmtDate(s.createdAt)}</td>
                        <td className={`${TD} text-center text-[#9CA3AF]`}>
                          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="border border-[#E4E8EE] p-0">
                            <StudentProfile s={s} onSendCredentials={() => openSendModal(s)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#E4E8EE] bg-[#FAFBFC] px-3 py-2 text-[11.5px] text-[#6B7280]">
            <RowCount shown={filtered.length} total={students.length} noun="students" />
            <span>Click a row to view full profile</span>
          </div>
        </div>
      )}

      {/* Send Credentials Modal */}
      {sendModal && (
        <ModalShell
          eyebrow="Send credentials"
          title={sendModal.name}
          onClose={closeSendModal}
          maxWidth="max-w-sm"
        >
          {sendSuccess ? (
            <div className="space-y-4 p-5 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#047857]/10">
                <CheckCircle2 className="h-6 w-6 text-[#047857]" />
              </div>
              <div>
                <p className="text-[14.5px] font-semibold text-[#111827]">Credentials sent</p>
                <p className="mt-1 text-[12px] text-[#6B7280]">
                  Emailed the Olympiad ID, User ID and password to{' '}
                  <span className="font-medium text-[#374151]">{sendSuccess}</span>.
                </p>
              </div>
              <button onClick={closeSendModal} className={`cursor-pointer ${BTN_PRIMARY} w-full`}>Done</button>
            </div>
          ) : (
            <div className="space-y-3 p-5">
              <p className="text-[12px] leading-relaxed text-[#4B5563]">
                Use this if credentials weren&apos;t sent automatically during allocation. This resends the login
                details already on file — no new password is generated.
              </p>
              <div>
                <label htmlFor="send-email" className={LABEL}>Email address</label>
                <div className="relative">
                  <Mail size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    id="send-email"
                    type="email" placeholder="student@example.com" value={sendEmail}
                    onChange={e => setSendEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendCredentials()}
                    autoFocus
                    className={`${INPUT} pl-8`}
                  />
                </div>
              </div>
              {sendError && (
                <p className="flex items-center gap-1.5 text-[12px] text-[#B91C1C]">
                  <AlertCircle size={12} /> {sendError}
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={closeSendModal} className={`cursor-pointer ${BTN_SECONDARY} flex-1`}>Cancel</button>
                <button onClick={handleSendCredentials} disabled={sending} className={`cursor-pointer ${BTN_PRIMARY} flex-1`}>
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </div>
  );
}
