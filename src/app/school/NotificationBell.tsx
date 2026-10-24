// School notifications are switched off for now. To bring them back, remove the "// " prefix below.
// 'use client';
//
// import { useCallback, useEffect, useRef, useState } from 'react';
// import { usePathname, useRouter } from 'next/navigation';
// import { Bell, Award, Contact, Megaphone, CheckCheck, type LucideIcon } from 'lucide-react';
//
// interface Item {
//   id: string;
//   type: string;
//   title: string;
//   message: string;
//   link: string | null;
//   readAt: string | null;
//   createdAt: string;
// }
//
// const TYPE_ICON: Record<string, LucideIcon> = {
//   PASSPORTS_RELEASED: Award,
//   OLYMPIAD_IDS_ADDED: Contact,
//   ANNOUNCEMENT: Megaphone,
// };
//
// const POLL_MS = 60_000;
//
// function timeAgo(iso: string) {
//   const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
//   if (mins < 1) return 'Just now';
//   if (mins < 60) return `${mins}m ago`;
//   const hrs = Math.floor(mins / 60);
//   if (hrs < 24) return `${hrs}h ago`;
//   const days = Math.floor(hrs / 24);
//   if (days < 7) return `${days}d ago`;
//   return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
// }
//
// /**
//  * The School Panel bell: messages from the Mittmee team and system events
//  * (passports released, new Olympiad IDs). Unread count on the bell; clicking a
//  * notification marks it read and opens the page it points to.
//  */
// export default function NotificationBell() {
//   const router = useRouter();
//   const pathname = usePathname();
//   const [open, setOpen] = useState(false);
//   const [items, setItems] = useState<Item[]>([]);
//   const [unread, setUnread] = useState(0);
//   const [loaded, setLoaded] = useState(false);
//   const wrapRef = useRef<HTMLDivElement>(null);
//
//   const auth = useCallback((): HeadersInit | null => {
//     const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') : null;
//     return token ? { Authorization: `Bearer ${token}` } : null;
//   }, []);
//
//   const load = useCallback(async () => {
//     const headers = auth();
//     if (!headers) return;
//     try {
//       const res = await fetch('/api/school/me/notifications', { headers });
//       if (!res.ok) return;
//       const j = await res.json();
//       setItems(j.items || []);
//       setUnread(j.unread || 0);
//     } catch { /* keep what we have */ } finally {
//       setLoaded(true);
//     }
//   }, [auth]);
//
//   // Fresh on every navigation, then quietly every minute while the tab is visible.
//   useEffect(() => { load(); }, [load, pathname]);
//   useEffect(() => {
//     const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
//     return () => clearInterval(t);
//   }, [load]);
//
//   // Close on outside click / Escape.
//   useEffect(() => {
//     if (!open) return;
//     const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
//     const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
//     document.addEventListener('mousedown', onDown);
//     document.addEventListener('keydown', onKey);
//     return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
//   }, [open]);
//
//   const markRead = async (ids?: string[]) => {
//     const headers = auth();
//     if (!headers) return;
//     // Optimistic: the bell clears immediately, the server catches up.
//     const now = new Date().toISOString();
//     setItems(prev => prev.map(i => (!i.readAt && (!ids || ids.includes(i.id)) ? { ...i, readAt: now } : i)));
//     setUnread(prev => (ids ? Math.max(0, prev - items.filter(i => !i.readAt && ids.includes(i.id)).length) : 0));
//     try {
//       await fetch('/api/school/me/notifications/read', {
//         method: 'POST',
//         headers: { ...headers, 'Content-Type': 'application/json' },
//         body: JSON.stringify(ids ? { ids } : {}),
//       });
//     } catch { /* next poll reconciles */ }
//   };
//
//   const openItem = (n: Item) => {
//     if (!n.readAt) markRead([n.id]);
//     if (n.link) { setOpen(false); router.push(n.link); }
//   };
//
//   return (
//     <div ref={wrapRef} className="relative">
//       <button
//         onClick={() => setOpen(o => !o)}
//         aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
//         aria-expanded={open}
//         className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#475265] transition-colors hover:bg-[#F4F5F7] hover:text-[#0F1B2D] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#1559C7]/25"
//       >
//         <Bell size={18} strokeWidth={1.75} />
//         {unread > 0 && (
//           <span className="absolute right-0.5 top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#DC2626] px-1 text-[10px] font-semibold leading-none tabular-nums text-white ring-2 ring-white">
//             {unread > 9 ? '9+' : unread}
//           </span>
//         )}
//       </button>
//
//       {open && (
//         <div
//           role="dialog"
//           aria-label="Notifications"
//           className="absolute right-0 top-11 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[#E6E8EC] bg-white shadow-[0_12px_32px_rgba(15,27,45,0.14)]"
//         >
//           <div className="flex items-center justify-between border-b border-[#EEF0F3] px-4 py-3">
//             <p className="text-[13.5px] font-semibold text-[#0F1B2D]">Notifications</p>
//             {unread > 0 && (
//               <button onClick={() => markRead()} className="flex cursor-pointer items-center gap-1 text-[12px] font-medium text-[#1559C7] hover:underline">
//                 <CheckCheck size={13} /> Mark all read
//               </button>
//             )}
//           </div>
//
//           <div className="max-h-[420px] overflow-y-auto">
//             {!loaded ? (
//               <p className="px-4 py-8 text-center text-[12.5px] text-[#677285]">Loading…</p>
//             ) : items.length === 0 ? (
//               <div className="px-4 py-10 text-center">
//                 <Bell size={20} strokeWidth={1.5} className="mx-auto mb-2 text-[#98A1B2]" />
//                 <p className="text-[13px] font-medium text-[#0F1B2D]">You&apos;re all caught up</p>
//                 <p className="mt-0.5 text-[12px] text-[#677285]">New updates from the team will show up here.</p>
//               </div>
//             ) : (
//               <ul>
//                 {items.map(n => {
//                   const Icon = TYPE_ICON[n.type] || Bell;
//                   return (
//                     <li key={n.id}>
//                       <button
//                         onClick={() => openItem(n)}
//                         className={`flex w-full cursor-pointer items-start gap-3 border-b border-[#EEF0F3] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#F6F8FC] ${n.readAt ? '' : 'bg-[#F4F8FE]'}`}
//                       >
//                         <span className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${n.readAt ? 'bg-[#F4F5F7] text-[#677285]' : 'bg-[#EEF3FC] text-[#1559C7]'}`}>
//                           <Icon size={15} strokeWidth={1.75} />
//                         </span>
//                         <span className="min-w-0 flex-1">
//                           <span className="flex items-start justify-between gap-2">
//                             <span className={`text-[13px] leading-snug text-[#0F1B2D] ${n.readAt ? 'font-medium' : 'font-semibold'}`}>{n.title}</span>
//                             {!n.readAt && <span aria-label="Unread" className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#1559C7]" />}
//                           </span>
//                           <span className="mt-0.5 line-clamp-3 block text-[12.5px] leading-snug text-[#475265]">{n.message}</span>
//                           <span className="mt-1 block text-[11px] text-[#8A93A3]">{timeAgo(n.createdAt)}</span>
//                         </span>
//                       </button>
//                     </li>
//                   );
//                 })}
//               </ul>
//             )}
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
//
export {};
