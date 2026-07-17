'use client';

import { useEffect, useMemo, useState } from 'react';
import { Users, Loader2, Search, Download, BookOpen, Calendar, Phone, Award, Mail, X, CheckCircle, Send } from 'lucide-react';

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
}

const avatarGradients = [
  'from-[#1559C7] to-[#2a78d6]',
  'from-[#0d9f6e] to-[#1baf7a]',
  'from-[#4a3aa7] to-[#7a6ad6]',
  'from-[#e34948] to-[#eb6834]',
  'from-[#d98600] to-[#eda100]',
];

export default function SchoolRegisteredStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [view, setView] = useState<'table' | 'cards'>('table');

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
      const label = s.className || s.classCode || 'Unknown';
      map.set(key, label);
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

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const dotTexture: React.CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(11,11,11,0.035) 0px, rgba(11,11,11,0.035) 1px, transparent 1px, transparent 10px)',
  };

  return (
    <div className="space-y-4">

      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#d98600] to-[#eda100] p-6 text-white shadow-[0_8px_24px_rgba(217,134,0,0.25)]">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-24 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">School Panel</p>
              <h1 className="text-xl font-black tracking-tight">My Students</h1>
            </div>
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white px-4 py-2 text-xs font-bold rounded-full hover:bg-white/25 transition-colors disabled:opacity-40"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1559C7] to-[#2a78d6] rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.12)] p-4 text-white">
          <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
          <p className="relative text-[11px] font-semibold text-white/85">Total Students</p>
          <p className="relative text-2xl font-black mt-1">{students.length}</p>
        </div>
        {classes.map((cls, i) => {
          const count = students.filter(s => (s.classCode || 'UNKNOWN') === cls.code).length;
          return (
            <div key={cls.code} className={`relative overflow-hidden bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} rounded-2xl shadow-[0_6px_20px_rgba(0,0,0,0.12)] p-4 text-white`}>
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-white/10" />
              <p className="relative text-[11px] font-semibold text-white/85 truncate">{cls.name}</p>
              <p className="relative text-2xl font-black mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filters & View Toggle */}
      <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
          <input
            type="text"
            placeholder="Search by name, ID or phone"
            className="w-full pl-9 pr-3 py-2 border border-[#E7EBF2] rounded-full text-[12px] focus:outline-none focus:border-[#1559C7] transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {classes.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setClassFilter('ALL')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition-colors ${classFilter === 'ALL' ? 'bg-[#1559C7] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
            >All Classes</button>
            {classes.map(cls => (
              <button key={cls.code} onClick={() => setClassFilter(cls.code)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-full transition-colors ${classFilter === cls.code ? 'bg-[#1559C7] text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
              >{cls.name}</button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center bg-gray-50 rounded-full p-1">
          <button onClick={() => setView('table')}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-full transition-colors ${view === 'table' ? 'bg-[#1559C7] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Table
          </button>
          <button onClick={() => setView('cards')}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded-full transition-colors ${view === 'cards' ? 'bg-[#1559C7] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Cards
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] py-20 flex flex-col items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#1559C7]" />
          <p className="text-sm text-gray-500">Loading student records...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-red-200 py-16 text-center text-red-600 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Users size={26} className="text-gray-300" />
          </div>
          <p className="text-gray-500 text-sm">
            {students.length === 0 ? 'No students yet. Allot Olympiad IDs to get started.' : 'No students match your filters.'}
          </p>
        </div>
      ) : view === 'table' ? (
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-gradient-to-r from-[#1559C7]/5 to-transparent text-gray-500">
                  <th className="border border-[#E7EBF2] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wide w-12">Sr.No.</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wide">Student Name</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wide w-36">Olympiad ID</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wide w-24">Class</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wide w-32">Phone</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-wide w-28">Joined On</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-center text-[10.5px] font-bold uppercase tracking-wide w-20">Videos</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-center text-[10.5px] font-bold uppercase tracking-wide w-20">Via</th>
                  <th className="border border-[#E7EBF2] px-4 py-3 text-center text-[10.5px] font-bold uppercase tracking-wide w-36">Credentials</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`hover:bg-[#1559C7]/[0.03] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="border border-[#E7EBF2] px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          {getInitials(s.name)}
                        </div>
                        <span className="font-semibold text-black text-sm">{s.name}</span>
                      </div>
                    </td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5 font-mono text-xs font-bold text-[#1559C7]">{s.olympiadCode}</td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5">
                      {s.className || s.classCode ? (
                        <span className="text-xs text-gray-700">{s.className || s.classCode}</span>
                      ) : <span className="text-gray-400 text-xs">-</span>}
                    </td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5 text-sm text-gray-600 font-mono">{s.phone}</td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5 text-xs text-gray-500">
                      {new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5 text-center">
                      {(() => {
                        const count = s.olympiadVideos ?? 0;
                        return (
                          <span className="text-xs font-bold text-[#0d9f6e] font-mono bg-[#0d9f6e]/10 px-2 py-0.5 rounded-full">{count}/2</span>
                        );
                      })()}
                    </td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5 text-center">
                      {s.source === 'app'
                        ? <span className="text-[10px] font-bold text-[#4a3aa7] bg-[#4a3aa7]/10 px-2 py-0.5 rounded-full">APP</span>
                        : <span className="text-[10px] font-bold text-[#1559C7] bg-[#1559C7]/10 px-2 py-0.5 rounded-full">WEB</span>
                      }
                    </td>
                    <td className="border border-[#E7EBF2] px-4 py-2.5 text-center">
                      {s.source === 'app' ? (
                        <button onClick={() => openSendModal(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#1559C7] to-[#2a78d6] text-white text-[10px] font-bold hover:shadow-sm transition-shadow">
                          <Send size={10} /> Send Credentials
                        </button>
                      ) : <span className="text-[11px] text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-2.5 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-400 bg-gray-50/50">
            <span>Showing <span className="font-bold text-gray-600">{filtered.length}</span> of <span className="font-bold text-gray-600">{students.length}</span> students</span>
            <span className="font-semibold">mittmee</span>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s, i) => (
            <div key={s.id} className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] transition-shadow p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradients[i % avatarGradients.length]} text-white text-sm font-bold flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  {getInitials(s.name)}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-black truncate">{s.name}</p>
                  <p className="font-mono text-xs text-[#1559C7] font-semibold">{s.olympiadCode}</p>
                </div>
                <div className="ml-auto flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.source === 'app' ? 'text-[#4a3aa7] bg-[#4a3aa7]/10' : 'text-[#1559C7] bg-[#1559C7]/10'}`}>{s.source === 'app' ? 'APP' : 'WEB'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-gray-600">
                {(s.className || s.classCode) && (
                  <div className="flex items-center gap-2">
                    <BookOpen size={11} className="text-[#1559C7] flex-shrink-0" />
                    <span>{s.className || s.classCode}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Phone size={11} className="text-gray-400 flex-shrink-0" />
                  <span className="font-mono">{s.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={11} className="text-gray-400 flex-shrink-0" />
                  <span>{new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award size={11} className="text-[#d98600] flex-shrink-0" />
                  <span>{s.olympiadVideos ?? 0}/2 videos uploaded</span>
                </div>
              </div>
              {s.source === 'app' && (
                <button onClick={() => openSendModal(s)}
                  className="inline-flex items-center justify-center gap-1.5 py-1.5 rounded-full bg-gradient-to-r from-[#1559C7] to-[#2a78d6] text-white text-[11px] font-bold hover:shadow-sm transition-shadow">
                  <Send size={11} /> Send Credentials
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Send Credentials Modal */}
      {sendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.2)] w-full max-w-sm mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0d1a6e] to-[#1559C7] px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Send Credentials</p>
                <p className="text-white font-bold text-sm mt-0.5">{sendModal.name}</p>
              </div>
              <button onClick={closeSendModal} className="text-white/60 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {sendSuccess ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0d9f6e] to-[#1baf7a] flex items-center justify-center mx-auto shadow-[0_4px_14px_rgba(13,159,110,0.3)]">
                  <CheckCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-black text-black text-base">Credentials Sent!</p>
                  <p className="text-xs text-gray-500 mt-1">Emailed the Olympiad ID, User ID and password to <span className="font-semibold">{sendSuccess}</span>.</p>
                </div>
                <button onClick={closeSendModal}
                  className="w-full py-2.5 rounded-full bg-gradient-to-r from-[#0d9f6e] to-[#1baf7a] text-white text-sm font-bold hover:shadow-[0_4px_14px_rgba(13,159,110,0.35)] transition-shadow">
                  Done
                </button>
              </div>
            ) : (
              <div className="p-5 space-y-3.5">
                <p className="text-xs text-gray-500">
                  Use this if credentials weren&apos;t sent automatically during allocation (e.g. mail failed). This resends the same login details already on file — no new password is generated.
                </p>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email" placeholder="student@example.com" value={sendEmail}
                      onChange={e => setSendEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendCredentials()}
                      autoFocus
                      className="w-full pl-8 pr-3 rounded-xl border border-[#E7EBF2] py-2 text-sm focus:outline-none focus:border-[#1559C7] focus:ring-1 focus:ring-[#1559C7]"
                    />
                  </div>
                </div>
                {sendError && <p className="text-xs text-red-500">{sendError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={closeSendModal}
                    className="flex-1 py-2.5 rounded-full border border-[#E7EBF2] text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSendCredentials} disabled={sending}
                    className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-[#1559C7] to-[#2a78d6] text-white text-sm font-bold hover:shadow-[0_4px_14px_rgba(21,89,199,0.35)] transition-shadow disabled:opacity-50 flex items-center justify-center gap-2">
                    {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
