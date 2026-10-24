// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// 'use client';
//
// import { useEffect, useState } from 'react';
// import useSWR from 'swr';
// import { Bell, Loader2, Send, X, Search, CheckCircle2, Megaphone } from 'lucide-react';
// import { fetcher, authFetch } from '@/lib/swr';
// import { NOTIFICATION_LIMITS } from '@/lib/schoolNotificationConfig';
//
// type Mode = 'ALL' | 'STATE' | 'SCHOOLS';
// interface PickedSchool { schoolId: string; name: string; city: string | null; state: string | null }
// interface HistoryEntry { title: string; message: string; link: string | null; sentAt: string; recipients: number; read: number }
//
// // Where a notification can take the school when clicked.
// const LINKS: { value: string; label: string }[] = [
//   { value: '', label: 'No link' },
//   { value: '/school/passports', label: 'Student Passports' },
//   { value: '/school/olympiad-ids', label: 'Olympiad IDs' },
//   { value: '/school/registered-students', label: 'My Students' },
//   { value: '/school/student-videos', label: 'Student Videos' },
//   { value: '/school/upload-video', label: 'Upload Video' },
//   { value: '/school/support', label: 'Help & Support' },
// ];
//
// export default function SchoolNotificationsPage() {
//   const [title, setTitle] = useState('');
//   const [message, setMessage] = useState('');
//   const [link, setLink] = useState('');
//   const [mode, setMode] = useState<Mode>('ALL');
//   const [states, setStates] = useState<string[]>([]);
//   const [schools, setSchools] = useState<PickedSchool[]>([]);
//   const [search, setSearch] = useState('');
//   const [debounced, setDebounced] = useState('');
//   const [sending, setSending] = useState(false);
//   const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
//
//   useEffect(() => {
//     const t = setTimeout(() => setDebounced(search.trim()), 300);
//     return () => clearTimeout(t);
//   }, [search]);
//
//   const { data: picker } = useSWR<{ states: string[]; schools: PickedSchool[] }>(
//     `/api/dashboard/school-notifications/schools?q=${encodeURIComponent(mode === 'SCHOOLS' ? debounced : '')}`, fetcher, { keepPreviousData: true },
//   );
//   const { data: hist, mutate: refreshHistory } = useSWR<{ history: HistoryEntry[] }>('/api/dashboard/school-notifications', fetcher);
//
//   const toggleState = (s: string) => setStates(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]));
//   const addSchool = (s: PickedSchool) => setSchools(prev => (prev.some(p => p.schoolId === s.schoolId) ? prev : [...prev, s]));
//
//   const targetReady = mode === 'ALL' || (mode === 'STATE' && states.length > 0) || (mode === 'SCHOOLS' && schools.length > 0);
//   const canSend = title.trim() && message.trim() && targetReady && !sending;
//   const targetLabel = mode === 'ALL' ? 'ALL active schools' : mode === 'STATE' ? `schools in ${states.join(', ')}` : `${schools.length} selected school${schools.length === 1 ? '' : 's'}`;
//
//   const send = async () => {
//     if (!canSend) return;
//     if (!window.confirm(`Send "${title.trim()}" to ${targetLabel}?\n\nIt will appear in their notification bell right away.`)) return;
//     setSending(true);
//     setResult(null);
//     try {
//       const res = await authFetch('/api/dashboard/school-notifications', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           title, message, link: link || undefined,
//           target: mode === 'ALL' ? { mode } : mode === 'STATE' ? { mode, states } : { mode, schoolIds: schools.map(s => s.schoolId) },
//         }),
//       });
//       const j = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(j.message || 'Could not send the notification');
//       setResult({ ok: true, text: `Sent to ${j.sent} school${j.sent === 1 ? '' : 's'}.` });
//       setTitle(''); setMessage(''); setLink(''); setStates([]); setSchools([]); setSearch('');
//       refreshHistory();
//     } catch (e: any) {
//       setResult({ ok: false, text: e?.message || 'Could not send the notification' });
//     } finally {
//       setSending(false);
//     }
//   };
//
//   const inputCls = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-400 outline-none bg-white';
//
//   return (
//     <div className="space-y-6 pb-8">
//       <div className="flex items-center gap-3">
//         <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#009846] to-emerald-600 flex items-center justify-center shadow-lg shadow-green-200">
//           <Bell className="text-white" size={22} />
//         </div>
//         <div>
//           <h1 className="text-2xl font-extrabold text-gray-900">School Notifications</h1>
//           <p className="text-sm text-gray-400">Send a message to schools&apos; notification bell. Passport releases and new Olympiad IDs notify the school automatically.</p>
//         </div>
//       </div>
//
//       <div className="grid lg:grid-cols-5 gap-6 items-start">
//         <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
//           <div>
//             <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Title</label>
//             <input value={title} onChange={e => setTitle(e.target.value)} maxLength={NOTIFICATION_LIMITS.title} placeholder="e.g. Exam date update" className={`${inputCls} mt-1`} />
//           </div>
//           <div>
//             <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Message</label>
//             <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={NOTIFICATION_LIMITS.message} rows={4} placeholder="What should the school know?" className={`${inputCls} mt-1 resize-y`} />
//             <p className="mt-1 text-[11px] text-gray-400 text-right">{message.length}/{NOTIFICATION_LIMITS.message}</p>
//           </div>
//           <div>
//             <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Opens (optional)</label>
//             <select value={link} onChange={e => setLink(e.target.value)} className={`${inputCls} mt-1`}>
//               {LINKS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
//             </select>
//           </div>
//
//           <div>
//             <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Send to</label>
//             <div className="mt-1 flex gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1 w-fit">
//               {([['ALL', 'All schools'], ['STATE', 'By state'], ['SCHOOLS', 'Chosen schools']] as [Mode, string][]).map(([m, label]) => (
//                 <button key={m} type="button" onClick={() => setMode(m)}
//                   className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${mode === m ? 'bg-white shadow-sm text-[#009846]' : 'text-gray-500 hover:text-gray-700'}`}>
//                   {label}
//                 </button>
//               ))}
//             </div>
//
//             {mode === 'STATE' && (
//               <div className="mt-3 flex flex-wrap gap-2">
//                 {(picker?.states ?? []).map(s => (
//                   <button key={s} type="button" onClick={() => toggleState(s)}
//                     className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${states.includes(s) ? 'bg-[#009846] border-[#009846] text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
//                     {s}
//                   </button>
//                 ))}
//                 {!picker && <Loader2 size={16} className="animate-spin text-gray-300" />}
//               </div>
//             )}
//
//             {mode === 'SCHOOLS' && (
//               <div className="mt-3 space-y-2">
//                 <div className="relative">
//                   <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
//                   <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search school name or code…" className={`${inputCls} pl-9`} />
//                 </div>
//                 {debounced && (picker?.schools ?? []).length > 0 && (
//                   <ul className="border border-gray-100 rounded-xl divide-y divide-gray-50 max-h-52 overflow-y-auto">
//                     {picker!.schools.map(s => (
//                       <li key={s.schoolId}>
//                         <button type="button" onClick={() => addSchool(s)} className="w-full text-left px-3 py-2 hover:bg-gray-50 cursor-pointer">
//                           <p className="text-[13px] font-bold text-gray-800 truncate">{s.name}</p>
//                           <p className="text-[11px] text-gray-400">{[s.schoolId, s.city, s.state].filter(Boolean).join(' · ')}</p>
//                         </button>
//                       </li>
//                     ))}
//                   </ul>
//                 )}
//                 {schools.length > 0 && (
//                   <div className="flex flex-wrap gap-2">
//                     {schools.map(s => (
//                       <span key={s.schoolId} className="inline-flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-green-50 border border-green-200 text-xs font-semibold text-green-800">
//                         {s.name}
//                         <button type="button" onClick={() => setSchools(prev => prev.filter(p => p.schoolId !== s.schoolId))} aria-label={`Remove ${s.name}`} className="p-0.5 rounded-full hover:bg-green-100 cursor-pointer"><X size={12} /></button>
//                       </span>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>
//
//           <div className="flex items-center gap-3 pt-1">
//             <button onClick={send} disabled={!canSend}
//               className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#009846] text-white text-sm font-bold shadow-md hover:bg-[#007d3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
//               {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send notification
//             </button>
//             {result && (
//               <span className={`text-sm font-semibold ${result.ok ? 'text-emerald-700' : 'text-red-600'}`}>
//                 {result.ok && <CheckCircle2 size={14} className="inline mr-1 -mt-0.5" />}{result.text}
//               </span>
//             )}
//           </div>
//         </div>
//
//         <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
//           <div className="flex items-center gap-2 mb-3">
//             <Megaphone size={16} className="text-gray-400" />
//             <h2 className="text-sm font-bold text-gray-700">Recently sent</h2>
//           </div>
//           {!hist ? (
//             <Loader2 size={18} className="animate-spin text-gray-300" />
//           ) : hist.history.length === 0 ? (
//             <p className="text-sm text-gray-400">Nothing sent yet.</p>
//           ) : (
//             <ul className="space-y-3">
//               {hist.history.map(h => (
//                 <li key={`${h.sentAt}|${h.title}`} className="border border-gray-100 rounded-xl p-3">
//                   <p className="text-[13px] font-bold text-gray-800">{h.title}</p>
//                   <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.message}</p>
//                   <p className="text-[11px] text-gray-400 mt-1.5">
//                     {new Date(h.sentAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
//                     {' · '}{h.recipients} school{h.recipients === 1 ? '' : 's'} · {h.read} read
//                   </p>
//                 </li>
//               ))}
//             </ul>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
//
import { notFound } from 'next/navigation';
export default function Page() { notFound(); }
