'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, Video, X, CheckCircle2, AlertCircle, User, Music, Palette,
  ChevronDown, Lock, RefreshCw, Globe, EyeOff,
} from 'lucide-react';
import { OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL, getCatBSubs } from '@/lib/olympiad-categories';
import { clearSchoolSession } from '@/lib/session-token';
import { CARD, CARD_HEADER, CARD_TITLE, STACK, INPUT, LABEL, FOCUS, BTN_PRIMARY, avatarTint } from '../ui';
import { PageHeader, StatusBadge, Avatar, ProgressBar } from '../components';

type Student = { id: string; name: string; olympiadCode: string; className: string | null; classCode: string | null; source?: string };
type UploadState = 'idle' | 'uploading' | 'saving' | 'done' | 'error';
type Slots = { slotA: boolean; slotB: boolean; rejectedA: boolean; rejectedB: boolean; approvedCount: number };

/** Card section wrapper — every form group on this page uses the same chrome. */
function Section({ title, required, children, muted }: {
  title: string; required?: boolean; children: React.ReactNode; muted?: boolean;
}) {
  return (
    <div className={`${CARD} ${muted ? 'opacity-55' : ''}`}>
      <div className={CARD_HEADER}>
        <h2 className={CARD_TITLE}>
          {title}{required && <span className="ml-1 text-[#B91C1C]">*</span>}
        </h2>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

export default function UploadVideoPage() {
  const [students, setStudents]               = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch]     = useState('');
  const [showDropdown, setShowDropdown]       = useState(false);

  const [slots, setSlots]           = useState<Slots | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [videoFile, setVideoFile]   = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);

  const [category, setCategory]     = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [customTalent, setCustomTalent] = useState('');
  const [caption, setCaption]       = useState('');

  const [isPublic, setIsPublic] = useState(true);
  const [autoCrop, setAutoCrop] = useState(false);
  const [aspectMismatch, setAspectMismatch] = useState(false);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress]     = useState(0);
  const [errorMsg, setErrorMsg]     = useState('');
  const [lastVideoMeta, setLastVideoMeta] = useState<{ isEvaluation: boolean; category: string; subCategory: string } | null>(null);

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '';

  useEffect(() => {
    fetch('/api/school/me/upload-students', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setStudents)
      .finally(() => setLoadingStudents(false));
  }, [token]);

  // Fetch slots whenever student changes
  useEffect(() => {
    if (!selectedStudent) { setSlots(null); return; }
    setSlotsLoading(true);
    fetch(`/api/school/me/student-slots?studentId=${selectedStudent.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSlots(data); })
      .finally(() => setSlotsLoading(false));
    // Reset category when student changes
    setCategory(''); setSubCategory(''); setCustomTalent('');
  }, [selectedStudent, token]);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.olympiadCode.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const CATEGORIES = [
    {
      label: OLYMPIAD_CAT_A_LABEL,
      value: OLYMPIAD_CAT_A_LABEL,
      icon: Music,
      subCategories: OLYMPIAD_CAT_A_SUBS,
    },
    {
      label: selectedStudent?.classCode === 'U' ? 'Speech / Talent' : OLYMPIAD_CAT_B_LABEL,
      value: OLYMPIAD_CAT_B_LABEL,
      icon: Palette,
      subCategories: getCatBSubs(selectedStudent?.classCode),
    },
  ];

  const selectedCat = CATEGORIES.find(c => c.value === category);

  // Category depends on the student's class (Cat B list differs by classCode),
  // so block selection until a student is chosen and their class has loaded.
  const canPickCategory = !!selectedStudent && !slotsLoading;

  // Both slots approved → only general feed
  const isGeneralOnly = slots !== null && slots.approvedCount >= 2;

  const getCatStatus = (catValue: string) => {
    if (!slots) return 'available';
    // Once both olympiad slots are filled, every further upload goes to the
    // general feed — categories are no longer "locked" by slot status, just
    // freely selectable so the school can still tag what kind of video it is.
    if (isGeneralOnly) return 'available';
    const isA = catValue === OLYMPIAD_CAT_A_LABEL;
    const filled = isA ? slots.slotA : slots.slotB;
    const rejected = isA ? slots.rejectedA : slots.rejectedB;
    if (filled && !rejected) return 'filled';     // submitted (pending/approved)
    if (rejected) return 'rejected';               // rejected → re-upload allowed
    return 'available';
  };

  const RATIO_TOLERANCE = 0.04;

  function handleFile(file: File) {
    if (!file.type.startsWith('video/')) { setErrorMsg('Please select a valid video file.'); return; }
    setErrorMsg('');
    setAutoCrop(false);
    setAspectMismatch(false);

    // Quick client-side pre-check for duration + aspect ratio so schools get
    // instant feedback instead of waiting for the upload round-trip to fail.
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      if (probe.duration > 120) {
        setErrorMsg(`Video is ${Math.ceil(probe.duration)}s long — it must be 2 minutes or shorter.`);
        URL.revokeObjectURL(url);
        return;
      }
      const ratio = probe.videoWidth / probe.videoHeight;
      const isPortrait916 = Math.abs(ratio - 9 / 16) <= RATIO_TOLERANCE;
      setAspectMismatch(!isPortrait916);
      setVideoFile(file);
      setVideoPreview(url);
    };
    probe.onerror = () => {
      // Let the server-side probe be the source of truth if the browser can't read it.
      setVideoFile(file);
      setVideoPreview(url);
    };
    probe.src = url;
  }

  const isCustomTalent = subCategory === 'Any Other Special Talent' || subCategory === 'Any Other';
  const finalSubCategory = isCustomTalent ? customTalent.trim() : subCategory;

  // Reads the body exactly once — calling res.json() in both the error and the
  // success path throws "body stream already read" and hides the real error.
  // A 401 here means the session died mid-upload, so bounce to /login.
  async function readJson(res: Response, fallbackMsg: string) {
    const body = await res.json().catch(() => null);
    if (res.status === 401) {
      clearSchoolSession();
      router.replace('/login');
      throw new Error('Your session expired. Please sign in again.');
    }
    if (!res.ok) throw new Error(body?.error || body?.message || fallbackMsg);
    return body;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !videoFile || !category || !subCategory) {
      setErrorMsg('Please fill all required fields and select a video.');
      return;
    }
    if (isCustomTalent && !customTalent.trim()) {
      setErrorMsg('Please enter the topic.');
      return;
    }
    if (aspectMismatch && !autoCrop) {
      setErrorMsg('This video is not in 9:16 format. Enable auto-crop above, or choose a portrait video.');
      return;
    }
    setErrorMsg('');
    setUploadState('uploading');
    setProgress(15);

    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      fd.append('studentId', selectedStudent.id);
      fd.append('autoCrop', String(autoCrop));

      const upRes = await fetch('/api/school/me/upload-video', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      setProgress(60);
      const { videoUrl, thumbnailUrl } = await readJson(upRes, 'Upload failed');

      setUploadState('saving');
      setProgress(80);

      const metaRes = await fetch('/api/school/me/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: selectedStudent.id, videoUrl, thumbnailUrl, caption, category, subCategory: finalSubCategory, isPublic }),
      });
      setProgress(100);
      const saved = await readJson(metaRes, 'Save failed');
      setLastVideoMeta({ isEvaluation: saved.isEvaluation, category: saved.category, subCategory: saved.subCategory });
      setUploadState('done');
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong');
      setUploadState('error');
    }
  }

  function reset() {
    setSelectedStudent(null); setStudentSearch(''); setVideoFile(null); setVideoPreview(null);
    setCategory(''); setSubCategory(''); setCustomTalent(''); setCaption(''); setIsPublic(true);
    setAutoCrop(false); setAspectMismatch(false);
    setUploadState('idle'); setProgress(0); setErrorMsg(''); setLastVideoMeta(null);
    setSlots(null);
  }

  /* — Done screen — */
  if (uploadState === 'done') {
    const isEval = lastVideoMeta?.isEvaluation ?? true;
    return (
      <div className="flex min-h-[65vh] items-center justify-center p-4">
        <div className={`${CARD} w-full max-w-md p-8 text-center`}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#047857]/10">
            <CheckCircle2 className="h-6 w-6 text-[#047857]" />
          </div>
          <h2 className="text-[17px] font-semibold text-[#111827]">Video uploaded</h2>
          <p className="mt-1 text-[12.5px] text-[#6B7280]">
            For <span className="font-medium text-[#374151]">{selectedStudent?.name}</span>
            {lastVideoMeta?.subCategory ? ` · ${lastVideoMeta.subCategory}` : ''}
          </p>

          <div className="mx-auto mt-5 rounded-lg border border-[#E4E8EE] bg-[#FAFBFC] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">Video type</p>
            <p className="mt-1 text-[14px] font-semibold text-[#111827]">
              {isEval ? 'Olympiad evaluation' : 'General feed'}
            </p>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[12px] leading-relaxed text-[#4B5563]">
              {isEval
                ? 'This video will be reviewed and scored as an olympiad participation entry.'
                : 'This student already has 2 approved olympiad videos, so this video appears in the general public feed only.'}
            </p>
          </div>

          <p className="mt-4 text-[12px] text-[#6B7280]">Status will update after admin review.</p>
          <button onClick={reset} className={`cursor-pointer ${BTN_PRIMARY} mt-5`}>Upload another</button>
        </div>
      </div>
    );
  }

  /* — Main — */
  return (
    <div className={STACK}>
      {/* The 9:16 / 2-minute limits are stated inside the drop zone where they
          are acted on, so they are not repeated in a hover-only subtitle. */}
      <PageHeader icon={Upload} title="Upload Student Video" subtitle="Upload on behalf of a student" />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">

          {/* — LEFT column (3/5) — */}
          <div className="space-y-3 xl:col-span-3">

            {/* Student selector */}
            <Section title="Select student" required>
              {loadingStudents ? (
                <div className="h-10 animate-pulse rounded-lg bg-[#F1F3F6]" />
              ) : students.length === 0 ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-[#D3DAE4] px-3.5 py-2.5 text-[12.5px] text-[#6B7280]">
                  <User className="h-4 w-4" /> No registered students found
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown(v => !v)}
                    aria-expanded={showDropdown}
                    className={`flex w-full items-center gap-2.5 rounded-lg border border-[#E4E8EE] bg-white px-3 py-2 text-left transition-colors hover:border-[#1559C7]/50 ${FOCUS}`}
                  >
                    {selectedStudent ? (
                      <>
                        <Avatar name={selectedStudent.name} tint={avatarTint(0)} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-[#111827]">{selectedStudent.name}</span>
                          <span className="block truncate text-[11.5px] text-[#6B7280]">
                            {selectedStudent.olympiadCode}{selectedStudent.className ? ` · ${selectedStudent.className}` : ''}
                          </span>
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Clear selected student"
                          onClick={e => { e.stopPropagation(); setSelectedStudent(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedStudent(null); } }}
                          className="flex-shrink-0 cursor-pointer rounded p-1 text-[#9CA3AF] hover:text-[#374151]"
                        >
                          <X className="h-4 w-4" />
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 flex-shrink-0 text-[#9CA3AF]" />
                        <span className="flex-1 text-[13px] text-[#6B7280]">Choose a student…</span>
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#9CA3AF]" />
                      </>
                    )}
                  </button>

                  {showDropdown && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-[#E4E8EE] bg-white shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
                      <div className="border-b border-[#F1F3F6] p-2">
                        <input
                          autoFocus type="text" placeholder="Search name or ID…"
                          aria-label="Search students"
                          value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          className={INPUT}
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <p className="py-5 text-center text-[12.5px] text-[#6B7280]">No students found</p>
                        ) : filtered.map((s, i) => (
                          <button
                            key={s.id} type="button"
                            onClick={() => { setSelectedStudent(s); setShowDropdown(false); setStudentSearch(''); }}
                            className="flex w-full items-center gap-2.5 border-b border-[#F6F7F9] px-3 py-2 text-left transition-colors last:border-0 hover:bg-[#1559C7]/[0.04]"
                          >
                            <Avatar name={s.name} tint={avatarTint(i)} size={26} />
                            <span className="min-w-0">
                              <span className="block truncate text-[12.5px] font-medium text-[#111827]">{s.name}</span>
                              <span className="block truncate text-[11.5px] text-[#6B7280]">
                                {s.olympiadCode}{s.className ? ` · ${s.className}` : ''}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Slot status */}
              {selectedStudent && (
                <div className="mt-2.5">
                  {slotsLoading ? (
                    <div className="h-7 animate-pulse rounded-lg bg-[#F1F3F6]" />
                  ) : slots && (
                    isGeneralOnly ? (
                      <StatusBadge tone="info" icon={CheckCircle2}>
                        Both olympiad slots filled — this video goes to General Feed
                      </StatusBadge>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {CATEGORIES.map(catInfo => {
                          const status = getCatStatus(catInfo.value);
                          return (
                            <StatusBadge
                              key={catInfo.value}
                              tone={status === 'filled' ? 'success' : status === 'rejected' ? 'danger' : 'neutral'}
                              icon={status === 'filled' ? CheckCircle2 : status === 'rejected' ? RefreshCw : undefined}
                            >
                              {catInfo.label} — {status === 'filled' ? 'Submitted' : status === 'rejected' ? 'Re-upload' : 'Pending'}
                            </StatusBadge>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}
            </Section>

            {/* Video drop zone */}
            <Section title="Video file" required>
              {videoPreview ? (
                <div className="space-y-2.5">
                  <div className="relative overflow-hidden rounded-lg bg-[#0E1726]">
                    <video src={videoPreview} controls className="max-h-64 w-full object-contain" />
                    <button
                      type="button"
                      aria-label="Remove video"
                      onClick={() => { setVideoFile(null); setVideoPreview(null); setAspectMismatch(false); setAutoCrop(false); }}
                      className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="flex items-center gap-1.5 text-[12px] text-[#4B5563]">
                    <Video className="h-3.5 w-3.5 flex-shrink-0 text-[#9CA3AF]" />
                    <span className="truncate">{videoFile?.name}</span>
                    <span className="flex-shrink-0 text-[#6B7280]">
                      · {((videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </p>

                  {aspectMismatch && (
                    <p className="flex items-start gap-2 rounded-lg bg-[#B91C1C]/[0.08] px-3 py-2.5 text-[12px] text-[#B91C1C]">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      This video is not in 9:16 (portrait) format. Enable auto-crop below, or upload a portrait video.
                    </p>
                  )}

                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#4B5563]">
                    <input
                      type="checkbox" checked={autoCrop}
                      onChange={e => setAutoCrop(e.target.checked)}
                      className="h-3.5 w-3.5 rounded accent-[#1559C7]"
                    />
                    Auto-crop to 9:16 if not already portrait
                  </label>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-9 text-center transition-colors ${
                    dragOver ? 'border-[#1559C7] bg-[#1559C7]/[0.04]' : 'border-[#D3DAE4] hover:border-[#1559C7] hover:bg-[#FAFBFC]'
                  }`}
                >
                  <div className={`mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    dragOver ? 'bg-[#1559C7] text-white' : 'bg-[#F1F3F6] text-[#6B7280]'
                  }`}>
                    <Upload className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-medium text-[#374151]">
                    {dragOver ? 'Drop it here' : 'Click to select or drag & drop'}
                  </p>
                  <p className="mt-1 text-[11.5px] text-[#6B7280]">
                    MP4, MOV, AVI · 9:16 portrait · Max 2 min · Auto-compressed above 150 MB
                  </p>
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              )}
            </Section>

            {/* Caption */}
            <Section title="Caption">
              <textarea
                value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Add a description for this video…"
                aria-label="Video caption"
                rows={3}
                className={`${INPUT} resize-none`}
              />
            </Section>
          </div>

          {/* — RIGHT column (2/5) — */}
          <div className="space-y-3 xl:col-span-2">

            {/* Visibility */}
            <Section title="Visibility">
              <div className="space-y-1.5">
                {[
                  { val: true,  icon: Globe,  label: 'Public',  desc: 'Anyone on Mittmee can see this video' },
                  { val: false, icon: EyeOff, label: 'Private', desc: 'Only reviewers and school can see this' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = isPublic === opt.val;
                  return (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => setIsPublic(opt.val)}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors ${FOCUS} ${
                        active ? 'border-[#1559C7] bg-[#1559C7]/[0.04]' : 'border-[#E4E8EE] hover:bg-[#FAFBFC]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[#1559C7]' : 'text-[#9CA3AF]'}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12.5px] font-semibold ${active ? 'text-[#1559C7]' : 'text-[#374151]'}`}>
                          {opt.label}
                        </span>
                        <span className="block text-[11.5px] text-[#6B7280]">{opt.desc}</span>
                      </span>
                      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                        active ? 'border-[#1559C7] bg-[#1559C7]' : 'border-[#D3DAE4]'
                      }`}>
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* General feed notice */}
            {isGeneralOnly && (
              <div className={`${CARD} p-3.5`}>
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1559C7]">
                  <AlertCircle size={13} /> General feed upload
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#4B5563]">
                  This student has 2 approved olympiad videos. Any further uploads go to the general feed —
                  not olympiad evaluation.
                </p>
              </div>
            )}

            {/* Category */}
            <Section title="Category" required muted={!canPickCategory}>
              {!canPickCategory && (
                <p className="mb-2 text-[12px] text-[#6B7280]">
                  {selectedStudent ? 'Loading student details…' : 'Select a student first to choose a category.'}
                </p>
              )}
              <div className="space-y-1.5">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.value;
                  const status = getCatStatus(cat.value);
                  const isFilled = status === 'filled';
                  const isRejected = status === 'rejected';
                  const isDisabled = isFilled || !canPickCategory;

                  return (
                    <button
                      key={cat.value}
                      type="button"
                      disabled={isDisabled}
                      aria-pressed={isSelected}
                      onClick={() => {
                        if (isDisabled) return;
                        setCategory(isSelected ? '' : cat.value);
                        setSubCategory(''); setCustomTalent('');
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${FOCUS} ${
                        isFilled
                          ? 'cursor-not-allowed border-[#E4E8EE] bg-[#FAFBFC]'
                          : !canPickCategory
                            ? 'cursor-not-allowed border-[#E4E8EE]'
                            : isSelected
                              ? 'border-[#1559C7] bg-[#1559C7]/[0.04]'
                              : 'border-[#E4E8EE] hover:bg-[#FAFBFC]'
                      }`}
                    >
                      {isFilled
                        ? <Lock className="h-4 w-4 flex-shrink-0 text-[#047857]" />
                        : <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-[#1559C7]' : 'text-[#9CA3AF]'}`} />}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12.5px] font-semibold ${
                          isFilled ? 'text-[#047857]' : isSelected ? 'text-[#1559C7]' : 'text-[#374151]'
                        }`}>{cat.label}</span>
                        {isFilled && <span className="block text-[11.5px] text-[#047857]">Already submitted</span>}
                        {isRejected && !isFilled && (
                          <span className="flex items-center gap-1 text-[11.5px] text-[#B91C1C]">
                            <RefreshCw className="h-2.5 w-2.5" /> Re-upload available
                          </span>
                        )}
                      </span>
                      {(isFilled || isSelected) && (
                        <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${isFilled ? 'text-[#047857]' : 'text-[#1559C7]'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Subcategory */}
            {selectedCat && (
              <Section title="Sub category" required>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCat.subCategories.map(sub => (
                    <button
                      key={sub} type="button"
                      onClick={() => {
                        setSubCategory(sub);
                        if (sub !== 'Any Other Special Talent' && sub !== 'Any Other') setCustomTalent('');
                      }}
                      aria-pressed={subCategory === sub}
                      className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${FOCUS} ${
                        subCategory === sub
                          ? 'border-[#1559C7] bg-[#1559C7] text-white'
                          : 'border-[#E4E8EE] text-[#4B5563] hover:bg-[#FAFBFC]'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>

                {isCustomTalent && (
                  <div className="mt-2.5">
                    <label htmlFor="custom-talent" className={LABEL}>
                      {subCategory === 'Any Other' ? 'Topic' : 'Talent name'} <span className="text-[#B91C1C]">*</span>
                    </label>
                    <input
                      id="custom-talent"
                      type="text"
                      value={customTalent}
                      onChange={e => setCustomTalent(e.target.value)}
                      placeholder={subCategory === 'Any Other' ? 'Enter the topic…' : 'Enter the talent name…'}
                      autoFocus
                      className={INPUT}
                    />
                  </div>
                )}
              </Section>
            )}

            {/* Error */}
            {errorMsg && (
              <p className="flex items-start gap-2 rounded-lg bg-[#B91C1C]/[0.08] px-3 py-2.5 text-[12.5px] text-[#B91C1C]" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {errorMsg}
              </p>
            )}

            {/* Progress */}
            {(uploadState === 'uploading' || uploadState === 'saving') && (
              <div className={`${CARD} p-3.5`}>
                <div className="mb-2 flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-[#374151]">
                    {uploadState === 'uploading' ? 'Uploading…' : 'Saving details…'}
                  </span>
                  <span className="font-semibold text-[#1559C7]">{progress}%</span>
                </div>
                <ProgressBar value={progress} />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={uploadState === 'uploading' || uploadState === 'saving'}
              className={`cursor-pointer ${BTN_PRIMARY} w-full !py-2.5`}
            >
              <Upload className="h-4 w-4" />
              {uploadState === 'uploading' ? 'Uploading…' : uploadState === 'saving' ? 'Saving…' : 'Upload video'}
            </button>
          </div>
        </div>
      </form>

      {showDropdown && <div className="fixed inset-0 z-20 cursor-default" onClick={() => setShowDropdown(false)} />}
    </div>
  );
}
