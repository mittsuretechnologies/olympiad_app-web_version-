'use client';

/**
 * Message thread of a School Panel support request, shared by the school's
 * view and the support team's dashboard view. `viewer` decides which side's
 * messages sit on the right ("you").
 */

import { FileText, Image as ImageIcon, Paperclip, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { SupportAttachment } from '@/lib/schoolSupport';

export interface ThreadMessage {
  id: string;
  kind: 'MESSAGE' | 'STATUS' | string;
  authorRole: 'SCHOOL' | 'TEAM' | string;
  authorName: string | null;
  body: string;
  attachments: SupportAttachment[] | null;
  createdAt: string;
}

const fmt = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

export function AttachmentChips({ items, onRemove }: { items: SupportAttachment[]; onRemove?: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((a, i) => (
        <span key={a.url} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-[#D9DDE4] bg-white px-2 py-1 text-[11.5px] text-[#2A3446]">
          {a.type === 'pdf' ? <FileText size={12} className="flex-shrink-0 text-[#B42323]" /> : <ImageIcon size={12} className="flex-shrink-0 text-[#1559C7]" />}
          <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">{a.name}</a>
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${a.name}`} className="flex-shrink-0 text-[#98A1B2] hover:text-[#B42323]">
              <X size={12} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

export function SupportThread({ messages, viewer }: { messages: ThreadMessage[]; viewer: 'SCHOOL' | 'TEAM' }) {
  return (
    <ol className="space-y-3">
      {messages.map(m => {
        if (m.kind === 'STATUS') {
          return (
            <li key={m.id} className="flex items-center gap-2 text-[11.5px] text-[#677285]">
              <span className="h-px flex-1 bg-[#E6E8EC]" />
              <span className="whitespace-nowrap">
                {m.authorRole === 'TEAM' ? 'Mittmee Support' : m.authorName || 'School'} · {m.body} · {fmt(m.createdAt)}
              </span>
              <span className="h-px flex-1 bg-[#E6E8EC]" />
            </li>
          );
        }
        const mine = m.authorRole === viewer;
        const label = m.authorRole === 'TEAM' ? 'Mittmee Support' : m.authorName || 'School';
        return (
          <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl border px-3.5 py-2.5 ${
              mine ? 'border-[#C9D8F3] bg-[#EEF3FC]' : m.authorRole === 'TEAM' ? 'border-[#CFE8D6] bg-[#F3FAF5]' : 'border-[#E6E8EC] bg-white'
            }`}>
              <p className="mb-1 text-[11.5px] font-semibold text-[#475265]">
                {mine ? 'You' : label} <span className="font-normal text-[#8A93A3]">· {fmt(m.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#0F1B2D]">{m.body}</p>
              <AttachmentChips items={m.attachments ?? []} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * "Attach file" button + chips. Uploads each file as soon as it is picked so
 * the message is sent with URLs only. Max 3 files, 5 MB each.
 */
export function AttachmentPicker({
  value,
  onChange,
  uploadUrl,
  token,
  max = 3,
}: {
  value: SupportAttachment[];
  onChange: (next: SupportAttachment[]) => void;
  uploadUrl: string;
  token: string;
  max?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    const room = max - value.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setErr(`You can attach up to ${max} files.`);
    setBusy(true);
    const added: SupportAttachment[] = [];
    try {
      for (const f of list) {
        if (f.size > 5 * 1024 * 1024) { setErr(`${f.name} is larger than 5 MB.`); continue; }
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        const json = await res.json().catch(() => null);
        if (!res.ok) { setErr(json?.message || `Could not upload ${f.name}.`); continue; }
        added.push(json.attachment);
      }
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
      if (added.length) onChange([...value, ...added]);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy || value.length >= max}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D9DDE4] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#475265] hover:bg-[#F8F9FB] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
          {busy ? 'Uploading…' : 'Attach screenshot / PDF'}
        </button>
        <span className="text-[11px] text-[#8A93A3]">Up to {max} files · 5 MB each</span>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          multiple
          hidden
          onChange={e => pick(e.target.files)}
        />
      </div>
      {err && <p className="mt-1 text-[11.5px] text-[#B42323]">{err}</p>}
      <AttachmentChips items={value} onRemove={i => onChange(value.filter((_, j) => j !== i))} />
    </div>
  );
}
