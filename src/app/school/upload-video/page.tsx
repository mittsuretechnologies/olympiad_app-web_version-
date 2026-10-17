'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, Video, X, CheckCircle2, AlertCircle, User, Music, Palette,
  ChevronDown, Lock, RefreshCw, Globe, EyeOff, Mic, School, Sparkles, Hash, Plus, Info, Crop,
} from 'lucide-react';
import VideoCropModal from './VideoCropModal';
import { OLYMPIAD_CAT_A_OPTIONS, OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL, getCatBSubs } from '@/lib/olympiad-categories';
import { SCHOOL_CATEGORY_GROUPS } from '@/lib/schoolUploadCategories';
import { schoolAutoTags, mainCategoryTag } from '@/lib/videoAutoTags';
import { MAX_CAPTION_LENGTH, MAX_CUSTOM_TAGS, MAX_VIDEO_SECONDS, VIDEO_TOO_LONG_MESSAGE, cleanHashtag } from '@/lib/uploadRules';

// Same policy pages the app links to from its upload screen (PolicyLinks.js).
const POLICY_SITE = 'https://www.mittmee.com';
import { clearSchoolSession } from '@/lib/session-token';
import { CARD, CARD_HEADER, CARD_TITLE, STACK, INPUT, FOCUS, BTN_PRIMARY, avatarTint } from '../ui';
import { PageHeader, StatusBadge, Avatar, ProgressBar } from '../components';

type Student = { id: string; name: string; olympiadCode: string; className: string | null; classCode: string | null; source?: string };
type UploadState = 'idle' | 'uploading' | 'saving' | 'done' | 'error';
type Slots = { slotA: boolean; slotB: boolean; rejectedA: boolean; rejectedB: boolean; approvedCount: number };
// 'student' = a student's Olympiad video; 'own' = the school's own video (same
// choice as the app's "For a student" / "Our own video").
type Mode = 'student' | 'own';

// The school's own-video categories, same as the app (lib/schoolUploadCategories).
const OWN_ICONS: Record<string, typeof Music> = {
  'Talent Performance': Sparkles,
  Rhymes: Music,
  'Speech & Presentation': Mic,
  'School Activity': School,
};
const OWN_CATEGORIES = SCHOOL_CATEGORY_GROUPS.map(g => ({
  label: g.label, value: g.label, icon: OWN_ICONS[g.label] ?? Palette, subCategories: [...g.subs],
}));

/** Card section wrapper — every form group on this page uses the same chrome. */
function Section({ title, required, children, muted }: {
  title: string; required?: boolean; children: React.ReactNode; muted?: boolean;
}) {
  return (
    <div className={`${CARD} ${muted ? 'opacity-55' : ''}`}>
      <div className={CARD_HEADER}>
        <h2 className={CARD_TITLE}>
          {title}{required && <span className="ml-1 text-[#B42323]">*</span>}
        </h2>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

export default function UploadVideoPage() {
  const [mode, setMode]                       = useState<Mode>('student');
  const isOwn = mode === 'own';
  const [students, setStudents]               = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [studentSearch, setStudentSearch]     = useState('');
  const [showDropdown, setShowDropdown]       = useState(false);
  // Class filter in the student picker, like the app's class chips.
  const [studentClass, setStudentClass]       = useState('ALL');

  const [slots, setSlots]           = useState<Slots | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [videoFile, setVideoFile]   = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);

  const [category, setCategory]     = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [caption, setCaption]       = useState('');
  const [tags, setTags]             = useState<string[]>([]);
  const [tagInput, setTagInput]     = useState('');
  // The school's own hashtags (state, district, name, CRM ID), added to every
  // upload by the server — shown here like the app's "Auto-added" list.
  const [schoolTags, setSchoolTags] = useState<string[]>([]);

  const [isPublic, setIsPublic] = useState(true);
  const [isMittfest, setIsMittfest] = useState(false);
  // Same as the app: a landscape video opens the crop screen; cropX is the
  // chosen position (0 = left edge, 1 = right edge), or null for the full video.
  const [isLandscape, setIsLandscape] = useState(false);
  const [cropX, setCropX]             = useState<number | null>(null);
  const [cropOpen, setCropOpen]       = useState(false);

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress]     = useState(0);
  const [errorMsg, setErrorMsg]     = useState('');
  const [lastVideoMeta, setLastVideoMeta] = useState<{ isEvaluation: boolean; category: string; subCategory: string } | null>(null);

  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '';

  useEffect(() => {
    fetch('/api/school/me/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p) setSchoolTags(schoolAutoTags(p)); })
      .catch(() => {});
  }, [token]);

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
    setCategory(''); setSubCategory('');
  }, [selectedStudent, token]);

  const filtered = students.filter(s =>
    (studentClass === 'ALL' || s.classCode === studentClass) && (
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.olympiadCode.toLowerCase().includes(studentSearch.toLowerCase())
    )
  );
  // Class chips: only shown when the school has students in two or more classes.
  const studentClasses = [...new Map(
    students.filter(s => s.classCode).map(s => [s.classCode as string, s.className || (s.classCode as string)])
  ).entries()];

  const CATEGORIES = [
    {
      label: OLYMPIAD_CAT_A_LABEL,
      value: OLYMPIAD_CAT_A_LABEL,
      icon: Music,
      subCategories: OLYMPIAD_CAT_A_OPTIONS,
    },
    {
      label: selectedStudent?.classCode === 'U' ? 'Speech / Talent' : OLYMPIAD_CAT_B_LABEL,
      value: OLYMPIAD_CAT_B_LABEL,
      icon: Palette,
      subCategories: getCatBSubs(selectedStudent?.classCode),
    },
  ];

  const categories = isOwn ? OWN_CATEGORIES : CATEGORIES;
  const selectedCat = categories.find(c => c.value === category);

  // Category depends on the student's class (Cat B list differs by classCode),
  // so block selection until a student is chosen and their class has loaded.
  // The school's own video needs no student.
  const canPickCategory = isOwn || (!!selectedStudent && !slotsLoading);

  // Both Olympiad categories are used (submitted or approved): a school can only
  // upload a student's Olympiad videos, so there is nothing left to upload.
  const bothFilled = !isOwn && slots !== null && slots.slotA && slots.slotB;

  const getCatStatus = (catValue: string) => {
    if (isOwn || !slots) return 'available';
    const isA = catValue === OLYMPIAD_CAT_A_LABEL;
    const filled = isA ? slots.slotA : slots.slotB;
    const rejected = isA ? slots.rejectedA : slots.rejectedB;
    if (filled && !rejected) return 'filled';     // submitted (pending/approved)
    if (rejected) return 'rejected';               // rejected → re-upload allowed
    return 'available';
  };

  // Auto tags the server will add: the school's, plus the main category on a
  // student's Olympiad video (see lib/videoAutoTags).
  const autoTags = [
    ...schoolTags,
    ...(!isOwn && category ? [mainCategoryTag(category, subCategory)].filter((t): t is string => !!t) : []),
  ];

  // Same pre-check the app runs (/api/app/check-text): an abusive caption or
  // hashtag is caught now, not after the video uploads. The save route checks
  // again, so a network error here lets the text through.
  async function textAllowed(texts: string[], field: 'caption' | 'hashtag') {
    try {
      const res = await fetch('/api/app/check-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ texts, field }),
      });
      const data = await res.json();
      if (res.ok && data.ok === false) {
        setErrorMsg(data.message || 'This contains words that are not allowed.');
        return false;
      }
    } catch { /* the server re-checks on save */ }
    return true;
  }

  async function addTag() {
    const raw = cleanHashtag(tagInput);
    if (!raw) return;
    const lower = raw.toLowerCase();
    if (tags.some(t => t.toLowerCase() === lower) || autoTags.some(t => t.toLowerCase() === lower)) { setTagInput(''); return; }
    if (tags.length >= MAX_CUSTOM_TAGS) { setErrorMsg(`Max ${MAX_CUSTOM_TAGS} hashtags.`); return; }
    if (!(await textAllowed([raw], 'hashtag'))) { setTagInput(''); return; }
    setErrorMsg('');
    setTags(prev => [...prev, raw]);
    setTagInput('');
  }

  function clearVideo() {
    setVideoFile(null); setVideoPreview(null);
    setIsLandscape(false); setCropX(null); setCropOpen(false);
  }

  function handleFile(file: File) {
    // Any video is accepted, whatever its length, shape or format. Some formats
    // (e.g. .mkv) reach the browser with no type, so the extension counts too.
    const looksLikeVideo = file.type.startsWith('video/')
      || /\.(mp4|m4v|mov|avi|mkv|webm|3gp|3g2|wmv|flv|mpe?g|ts|mts|m2ts|ogv)$/i.test(file.name);
    if (!looksLikeVideo) { setErrorMsg('Please select a video file.'); return; }
    setErrorMsg('');
    setIsLandscape(false); setCropX(null); setCropOpen(false);

    // A landscape video opens the crop screen straight away, as in the app.
    const url = URL.createObjectURL(file);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => {
      // Same 2-minute limit and message as the app's video picker.
      if (probe.duration > MAX_VIDEO_SECONDS) {
        setErrorMsg(VIDEO_TOO_LONG_MESSAGE);
        URL.revokeObjectURL(url);
        return;
      }
      const landscape = !!(probe.videoWidth && probe.videoHeight && probe.videoWidth > probe.videoHeight * 1.05);
      setIsLandscape(landscape);
      setCropOpen(landscape);
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
    if ((!isOwn && !selectedStudent) || !videoFile || !category || !subCategory) {
      setErrorMsg('Please fill all required fields and select a video.');
      return;
    }
    setErrorMsg('');
    if (caption.trim() && !(await textAllowed([caption], 'caption'))) return;
    setUploadState('uploading');
    setProgress(15);

    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      if (isOwn) fd.append('own', 'true');
      else fd.append('studentId', selectedStudent!.id);
      if (cropX !== null) fd.append('cropX', String(cropX));

      const upRes = await fetch('/api/school/me/upload-video', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      setProgress(60);
      const { videoUrl, thumbnailUrl } = await readJson(upRes, 'Upload failed');

      setUploadState('saving');
      setProgress(80);

      const metaRes = isOwn
        ? await fetch('/api/school/me/own-videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ videoUrl, thumbnailUrl, caption, category, subCategory, tags: tags.join(',') }),
          })
        : await fetch('/api/school/me/videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ studentId: selectedStudent!.id, videoUrl, thumbnailUrl, caption, category, subCategory, tags: tags.join(','), isPublic, isMittfest }),
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
    setCategory(''); setSubCategory(''); setCaption(''); setIsPublic(true); setIsMittfest(false);
    setTags([]); setTagInput('');
    setIsLandscape(false); setCropX(null); setCropOpen(false);
    setStudentClass('ALL');
    setUploadState('idle'); setProgress(0); setErrorMsg(''); setLastVideoMeta(null);
    setSlots(null);
  }

  /* — Done screen — */
  if (uploadState === 'done') {
    return (
      <div className="flex min-h-[65vh] items-center justify-center p-4">
        <div className={`${CARD} w-full max-w-md p-8 text-center`}>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1D7A3A]/10">
            <CheckCircle2 className="h-6 w-6 text-[#1D7A3A]" />
          </div>
          <h2 className="text-[17px] font-semibold text-[#0F1B2D]">Video uploaded</h2>
          <p className="mt-1 text-[12.5px] text-[#677285]">
            {isOwn
              ? <>Your school&apos;s video</>
              : <>For <span className="font-medium text-[#475265]">{selectedStudent?.name}</span></>}
            {lastVideoMeta?.subCategory ? ` · ${lastVideoMeta.subCategory}` : ''}
          </p>

          <div className="mx-auto mt-5 rounded-lg border border-[#E6E8EC] bg-[#F8F9FB] p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#677285]">Video type</p>
            <p className="mt-1 text-[14px] font-semibold text-[#0F1B2D]">
              {isOwn ? 'School video' : 'Olympiad evaluation'}
            </p>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[12px] leading-relaxed text-[#475265]">
              {isOwn
                ? 'Once approved, it shows on your school\'s profile in the Mittmee app.'
                : 'This video will be reviewed and scored as an olympiad participation entry.'}
            </p>
          </div>

          <p className="mt-4 text-[12px] text-[#677285]">Status will update after admin review.</p>
          <button onClick={reset} className={`cursor-pointer ${BTN_PRIMARY} mt-5`}>Upload another</button>
        </div>
      </div>
    );
  }

  /* — Main — */
  return (
    <div className={STACK}>
      {/* What the upload accepts is stated inside the drop zone where it is
          acted on, so it is not repeated in a hover-only subtitle. */}
      <PageHeader icon={Upload} title="Upload Video" />

      {/* Upload for a student (Olympiad) or the school's own video. */}
      <div className="inline-flex rounded-lg border border-[#E6E8EC] bg-white p-1" role="tablist" aria-label="Who is this video for">
        {([
          { key: 'student', label: 'For a student', icon: User },
          { key: 'own',     label: 'Our own video', icon: School },
        ] as const).map(opt => {
          const Icon = opt.icon;
          const active = mode === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={uploadState === 'uploading' || uploadState === 'saving'}
              onClick={() => {
                if (active) return;
                setMode(opt.key);
                setCategory(''); setSubCategory(''); setErrorMsg('');
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${FOCUS} ${
                active ? 'bg-[#1559C7] text-white' : 'text-[#475265] hover:bg-[#F8F9FB]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {opt.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">

          {/* — LEFT column (3/5) — */}
          <div className="space-y-3 xl:col-span-3">

            {/* Same notice the app shows on a non-Olympiad upload */}
            {isOwn && (
              <p className="flex items-start gap-2 rounded-lg border border-[#E6E8EC] bg-[#F8F9FB] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#475265]">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#677285]" />
                <span>
                  This platform is for children aged <span className="font-semibold">4 to 14 years</span>. Please ensure the performer is within this age group before uploading.
                </span>
              </p>
            )}

            {/* Student selector */}
            {!isOwn && (
            <Section title="Select student" required>
              {loadingStudents ? (
                <div className="h-10 animate-pulse rounded-lg bg-[#EEF0F3]" />
              ) : students.length === 0 ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-[#D2D7DF] px-3.5 py-2.5 text-[12.5px] text-[#677285]">
                  <User className="h-4 w-4" /> No registered students found
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDropdown(v => !v)}
                    aria-expanded={showDropdown}
                    className={`flex w-full items-center gap-2.5 rounded-lg border border-[#E6E8EC] bg-white px-3 py-2 text-left transition-colors hover:border-[#1559C7]/50 ${FOCUS}`}
                  >
                    {selectedStudent ? (
                      <>
                        <Avatar name={selectedStudent.name} tint={avatarTint(0)} size={28} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-[#0F1B2D]">{selectedStudent.name}</span>
                          <span className="block truncate text-[11.5px] text-[#677285]">
                            {selectedStudent.olympiadCode}{selectedStudent.className ? ` · ${selectedStudent.className}` : ''}
                          </span>
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="Clear selected student"
                          onClick={e => { e.stopPropagation(); setSelectedStudent(null); }}
                          onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedStudent(null); } }}
                          className="flex-shrink-0 cursor-pointer rounded p-1 text-[#98A1B2] hover:text-[#475265]"
                        >
                          <X className="h-4 w-4" />
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 flex-shrink-0 text-[#98A1B2]" />
                        <span className="flex-1 text-[13px] text-[#677285]">Choose a student…</span>
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#98A1B2]" />
                      </>
                    )}
                  </button>

                  {showDropdown && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-[#E6E8EC] bg-white shadow-[0_8px_24px_rgba(15,27,45,0.12)]">
                      <div className="border-b border-[#EEF0F3] p-2">
                        <p className="mb-1.5 px-0.5 text-[11px] text-[#677285]">{students.length} registered</p>
                        <input
                          autoFocus type="text" placeholder="Search name or ID…"
                          aria-label="Search students"
                          value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          className={INPUT}
                        />
                        {studentClasses.length >= 2 && (
                          <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by class">
                            {[['ALL', 'All classes'] as [string, string], ...studentClasses].map(([code, name]) => {
                              const on = studentClass === code;
                              return (
                                <button
                                  key={code}
                                  type="button"
                                  onClick={() => setStudentClass(code)}
                                  aria-pressed={on}
                                  className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${FOCUS} ${
                                    on ? 'border-[#1559C7] bg-[#1559C7] text-white' : 'border-[#E6E8EC] text-[#475265] hover:bg-[#F8F9FB]'
                                  }`}
                                >
                                  {name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <p className="py-5 text-center text-[12.5px] text-[#677285]">No student matches your search.</p>
                        ) : filtered.map((s, i) => (
                          <button
                            key={s.id} type="button"
                            onClick={() => { setSelectedStudent(s); setShowDropdown(false); setStudentSearch(''); }}
                            className="flex w-full items-center gap-2.5 border-b border-[#F8F9FB] px-3 py-2 text-left transition-colors last:border-0 hover:bg-[#1559C7]/[0.04]"
                          >
                            <Avatar name={s.name} tint={avatarTint(i)} size={26} />
                            <span className="min-w-0">
                              <span className="block truncate text-[12.5px] font-medium text-[#0F1B2D]">{s.name}</span>
                              <span className="block truncate text-[11.5px] text-[#677285]">
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
                    <div className="h-7 animate-pulse rounded-lg bg-[#EEF0F3]" />
                  ) : slots && (
                    bothFilled ? (
                      <StatusBadge tone="info" icon={CheckCircle2}>
                        Both Olympiad videos are already submitted — nothing more can be uploaded for this student
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
            )}

            {/* Video drop zone */}
            <Section title="Video file" required>
              {videoPreview ? (
                <div className="space-y-2.5">
                  <div className="relative overflow-hidden rounded-lg bg-[#0B1B33]">
                    {/* A chosen crop is previewed as it will look: the 9:16 part only. */}
                    {cropX !== null ? (
                      <div className="mx-auto aspect-[9/16] max-h-64">
                        <video src={videoPreview} controls className="h-full w-full object-cover" style={{ objectPosition: `${cropX * 100}% 50%` }} />
                      </div>
                    ) : (
                      <video src={videoPreview} controls className="max-h-64 w-full object-contain" />
                    )}
                    <button
                      type="button"
                      aria-label="Remove video"
                      onClick={clearVideo}
                      className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {isLandscape && (
                      <button
                        type="button"
                        onClick={() => setCropOpen(true)}
                        disabled={uploadState === 'uploading' || uploadState === 'saving'}
                        className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-black/80"
                      >
                        <Crop className="h-3.5 w-3.5" /> {cropX !== null ? 'Cropped' : 'Crop'}
                      </button>
                    )}
                  </div>

                  <p className="flex items-center gap-1.5 text-[12px] text-[#475265]">
                    <Video className="h-3.5 w-3.5 flex-shrink-0 text-[#98A1B2]" />
                    <span className="truncate">{videoFile?.name}</span>
                    <span className="flex-shrink-0 tabular-nums text-[#677285]">
                      · {((videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </p>

                  {isLandscape && (
                    <p className="flex items-start gap-2 text-[12px] text-[#677285]">
                      <Crop className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                      {cropX !== null
                        ? 'Will be cropped to portrait (9:16) after upload.'
                        : 'Landscape video — it will be uploaded in full. Use Crop to fit the portrait screen.'}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-lg border-2 border-dashed p-9 text-center transition-colors ${
                    dragOver ? 'border-[#1559C7] bg-[#1559C7]/[0.04]' : 'border-[#D2D7DF] hover:border-[#1559C7] hover:bg-[#F8F9FB]'
                  }`}
                >
                  <div className={`mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    dragOver ? 'bg-[#1559C7] text-white' : 'bg-[#EEF0F3] text-[#677285]'
                  }`}>
                    <Upload className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-medium text-[#475265]">
                    {dragOver ? 'Drop it here' : 'Click to select or drag & drop'}
                  </p>
                  <p className="mt-1 text-[11.5px] text-[#677285]">
                    Any video format · Max 2 min · Landscape videos can be cropped to portrait · Large files are compressed automatically
                  </p>
                  <input ref={fileInputRef} type="file" accept="video/*,.mkv,.avi,.wmv,.flv,.mts,.m2ts,.3gp" className="hidden"
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
                maxLength={MAX_CAPTION_LENGTH}
                rows={3}
                className={`${INPUT} resize-none`}
              />
            </Section>

            {/* Hashtags — same as the app: the auto-added ones, then custom ones */}
            <Section title="Hashtags">
              {autoTags.length > 0 && (
                !isOwn && !isPublic ? (
                  <p className="mb-2.5 flex items-center gap-1.5 text-[11.5px] text-[#677285]">
                    <Lock className="h-3 w-3 flex-shrink-0" />
                    School tags are hidden from public but still tracked in the background.
                  </p>
                ) : (
                  <div className="mb-2.5">
                    <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[#677285]">Auto-added from your school</p>
                    <div className="flex flex-wrap gap-1.5">
                      {autoTags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-[#EEF0F3] px-2 py-1 text-[11.5px] font-medium text-[#475265]">
                          <School className="h-3 w-3 text-[#98A1B2]" /> #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Hash className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98A1B2]" />
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                    placeholder="Add a custom hashtag"
                    aria-label="Add a custom hashtag"
                    className={`${INPUT} !pl-8`}
                  />
                </div>
                <button
                  type="button"
                  onClick={addTag}
                  disabled={!tagInput.trim()}
                  aria-label="Add hashtag"
                  className={`flex items-center justify-center rounded-lg bg-[#1559C7] px-3 text-white transition-colors hover:bg-[#124BA8] disabled:opacity-40 ${FOCUS}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                      aria-label={`Remove #${tag}`}
                      className={`inline-flex items-center gap-1 rounded-md border border-[#1559C7]/30 bg-[#1559C7]/[0.06] px-2 py-1 text-[11.5px] font-medium text-[#1559C7] hover:bg-[#1559C7]/[0.12] ${FOCUS}`}
                    >
                      #{tag} <X className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* — RIGHT column (2/5) — */}
          <div className="space-y-3 xl:col-span-2">

            {/* Visibility — a student's Olympiad video only; the app offers no
                choice on the school's own video (it is always public). */}
            {!isOwn && (
            <Section title="Visibility">
              {!isOwn && (
                <p className="mb-2 text-[11.5px] leading-relaxed text-[#677285]">
                  Choose now. It cannot be changed after the video is uploaded.
                </p>
              )}
              <div className="space-y-1.5">
                {[
                  { val: true,  icon: Globe,  label: 'Public',  desc: isOwn ? "Follows your school profile's privacy settings" : 'Anyone on Mittmee can see this video' },
                  { val: false, icon: EyeOff, label: 'Private', desc: isOwn ? 'Only your school and the Super Admin can see this' : 'Only the student and reviewers can see this' },
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
                        active ? 'border-[#1559C7] bg-[#1559C7]/[0.04]' : 'border-[#E6E8EC] hover:bg-[#F8F9FB]'
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-[#1559C7]' : 'text-[#98A1B2]'}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12.5px] font-semibold ${active ? 'text-[#1559C7]' : 'text-[#475265]'}`}>
                          {opt.label}
                        </span>
                        <span className="block text-[11.5px] text-[#677285]">{opt.desc}</span>
                      </span>
                      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                        active ? 'border-[#1559C7] bg-[#1559C7]' : 'border-[#D2D7DF]'
                      }`}>
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
            )}

            {/* MittFest - optional, on the student's behalf; not on the school's own video */}
            {!isOwn && (
            <Section title="MittFest">
              <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] text-[#475265]">
                <input
                  type="checkbox" checked={isMittfest}
                  onChange={e => setIsMittfest(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded accent-[#1559C7]"
                />
                <span>
                  <span className="block font-semibold">Is this video for MittFest?</span>
                  <span className="block text-[11.5px] text-[#677285]">Optional. Tick to also submit this student's video for MittFest.</span>
                </span>
              </label>
            </Section>
            )}

            {/* Nothing left to upload for this student */}
            {bothFilled && (
              <div className={`${CARD} p-3.5`}>
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#1559C7]">
                  <AlertCircle size={13} /> Olympiad videos complete
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-[#475265]">
                  This student already has both Olympiad videos (Talent Performance and Rhymes / Speech).
                  A school can only upload a student's Olympiad videos, so nothing more can be added.
                </p>
              </div>
            )}

            {/* Category */}
            <Section title="Category" required muted={!canPickCategory}>
              {!canPickCategory && (
                <p className="mb-2 text-[12px] text-[#677285]">
                  {selectedStudent ? 'Loading student details…' : 'Select a student first to choose a category.'}
                </p>
              )}
              <div className="space-y-1.5">
                {categories.map(cat => {
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
                        setSubCategory('');
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${FOCUS} ${
                        isFilled
                          ? 'cursor-not-allowed border-[#E6E8EC] bg-[#F8F9FB]'
                          : !canPickCategory
                            ? 'cursor-not-allowed border-[#E6E8EC]'
                            : isSelected
                              ? 'border-[#1559C7] bg-[#1559C7]/[0.04]'
                              : 'border-[#E6E8EC] hover:bg-[#F8F9FB]'
                      }`}
                    >
                      {isFilled
                        ? <Lock className="h-4 w-4 flex-shrink-0 text-[#1D7A3A]" />
                        : <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-[#1559C7]' : 'text-[#98A1B2]'}`} />}
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[12.5px] font-semibold ${
                          isFilled ? 'text-[#1D7A3A]' : isSelected ? 'text-[#1559C7]' : 'text-[#475265]'
                        }`}>{cat.label}</span>
                        {isFilled && <span className="block text-[11.5px] text-[#1D7A3A]">Already submitted</span>}
                        {isRejected && !isFilled && (
                          <span className="flex items-center gap-1 text-[11.5px] text-[#B42323]">
                            <RefreshCw className="h-2.5 w-2.5" /> Re-upload available
                          </span>
                        )}
                      </span>
                      {(isFilled || isSelected) && (
                        <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${isFilled ? 'text-[#1D7A3A]' : 'text-[#1559C7]'}`} />
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
                      // As in the app, every option ("Other", "Any Other" too) is
                      // saved by its own label; nothing is typed in.
                      onClick={() => setSubCategory(sub)}
                      aria-pressed={subCategory === sub}
                      className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${FOCUS} ${
                        subCategory === sub
                          ? 'border-[#1559C7] bg-[#1559C7] text-white'
                          : 'border-[#E6E8EC] text-[#475265] hover:bg-[#F8F9FB]'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* Error */}
            {errorMsg && (
              <p className="flex items-start gap-2 rounded-lg bg-[#B42323]/[0.08] px-3 py-2.5 text-[12.5px] text-[#B42323]" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {errorMsg}
              </p>
            )}

            {/* Progress */}
            {(uploadState === 'uploading' || uploadState === 'saving') && (
              <div className={`${CARD} p-3.5`}>
                <div className="mb-2 flex items-center justify-between text-[12.5px]">
                  <span className="font-medium text-[#475265]">
                    {uploadState === 'uploading' ? 'Uploading…' : 'Saving details…'}
                  </span>
                  <span className="font-semibold tabular-nums text-[#1559C7]">{progress}%</span>
                </div>
                <ProgressBar value={progress} />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={uploadState === 'uploading' || uploadState === 'saving' || bothFilled}
              className={`cursor-pointer ${BTN_PRIMARY} w-full !py-2.5`}
            >
              <Upload className="h-4 w-4" />
              {uploadState === 'uploading' ? 'Uploading…' : uploadState === 'saving' ? 'Saving…' : 'Upload video'}
            </button>
          </div>
        </div>
      </form>

      {/* The two policies that govern uploads, as on the app's upload screen —
          at the very bottom of the page. */}
      <p className="border-t border-[#E6E8EC] pt-3 text-center text-[11.5px] leading-relaxed text-[#677285]">
        Before you upload, please read our{' '}
        <a href={`${POLICY_SITE}/community-guidelines`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#1559C7] hover:underline">Community Guidelines</a>
        {' and '}
        <a href={`${POLICY_SITE}/infringement-policy`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#1559C7] hover:underline">Infringement Policy</a>.
      </p>

      {showDropdown && <div className="fixed inset-0 z-20 cursor-default" onClick={() => setShowDropdown(false)} />}

      {cropOpen && videoPreview && (
        <VideoCropModal
          src={videoPreview}
          initialX={cropX ?? 0.5}
          onCrop={x => { setCropX(x); setCropOpen(false); }}
          onKeepFull={() => { setCropX(null); setCropOpen(false); }}
        />
      )}
    </div>
  );
}
