'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Video, X, CheckCircle, AlertCircle, User, Music, Palette, ChevronDown, Lock, RefreshCw, Globe, EyeOff } from 'lucide-react';
import { OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL, getCatBSubs } from '@/lib/olympiad-categories';
import { clearSchoolSession } from '@/lib/session-token';

type Student = { id: string; name: string; olympiadCode: string; className: string | null; classCode: string | null; source?: string };
type UploadState = 'idle' | 'uploading' | 'saving' | 'done' | 'error';
type Slots = { slotA: boolean; slotB: boolean; rejectedA: boolean; rejectedB: boolean; approvedCount: number };

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

  // Both slots approved â†’ only general feed
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
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="relative overflow-hidden bg-white rounded-2xl border border-[#E7EBF2] shadow-[0_8px_28px_rgba(0,0,0,0.1)] p-10 text-center max-w-md w-full">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-emerald-50" />
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0d9f6e] to-[#1baf7a] flex items-center justify-center mx-auto mb-5 shadow-[0_6px_16px_rgba(13,159,110,0.3)]">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="relative text-xl font-black text-black mb-1">Video Uploaded</h2>
          <p className="relative text-gray-600 text-sm mb-5">
            For <span className="font-semibold text-black">{selectedStudent?.name}</span>
            {lastVideoMeta?.subCategory ? ` · ${lastVideoMeta.subCategory}` : ''}
          </p>

          {isEval ? (
            <div className="relative mx-auto mb-5 inline-flex flex-col items-center gap-1.5 bg-gradient-to-br from-[#d98600] to-[#eda100] rounded-2xl px-6 py-4 text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">Video Type</span>
              <span className="text-base font-black">Olympiad Evaluation</span>
              <p className="text-xs text-white/85 leading-snug max-w-[220px]">
                This video will be reviewed and scored as an olympiad participation entry.
              </p>
            </div>
          ) : (
            <div className="relative mx-auto mb-5 inline-flex flex-col items-center gap-1.5 bg-gradient-to-br from-[#1559C7] to-[#2a78d6] rounded-2xl px-6 py-4 text-white shadow-[0_4px_14px_rgba(0,0,0,0.12)]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/75">Video Type</span>
              <span className="text-base font-black">General Feed</span>
              <p className="text-xs text-white/85 leading-snug max-w-[240px]">
                This student already has 2 approved olympiad videos. This video will appear in the general public feed only.
              </p>
            </div>
          )}

          <p className="relative text-xs text-gray-500 mb-7">Status will update after admin review.</p>
          <button onClick={reset} className="relative bg-gradient-to-r from-[#1559C7] to-[#2a78d6] text-white px-6 py-2.5 text-sm font-bold rounded-full hover:shadow-[0_4px_14px_rgba(21,89,199,0.35)] transition-shadow">
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  /* — Main — */
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#e34948] to-[#eb6834] p-6 text-white shadow-[0_8px_24px_rgba(227,73,72,0.25)]">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-24 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Upload size={20} className="text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">School Panel</p>
            <h1 className="text-xl font-black tracking-tight">Upload Student Video</h1>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* — LEFT column (3/5) — */}
          <div className="xl:col-span-3 space-y-4">

            {/* Student selector */}
            <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2.5">
                Select Student <span className="text-red-500">*</span>
              </p>

              {loadingStudents ? (
                <div className="h-11 bg-gray-50 rounded-xl animate-pulse" />
              ) : students.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm">
                  <User className="w-4 h-4" /> No registered students found
                </div>
              ) : (
                <div className="relative">
                  <div
                    onClick={() => setShowDropdown(v => !v)}
                    className="flex items-center gap-3 rounded-xl border border-[#E7EBF2] px-4 py-2.5 cursor-pointer hover:border-[#1559C7] transition-colors bg-white"
                  >
                    {selectedStudent ? (
                      <>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1559C7] to-[#2a78d6] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                          {selectedStudent.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-black text-sm truncate">{selectedStudent.name}</p>
                          <p className="text-xs text-gray-500">{selectedStudent.olympiadCode}{selectedStudent.className ? ` · ${selectedStudent.className}` : ''}</p>
                        </div>
                        <button type="button" onClick={e => { e.stopPropagation(); setSelectedStudent(null); }} className="text-gray-400 hover:text-gray-600 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500 text-sm flex-1">Choose a student...</span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </>
                    )}
                  </div>

                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-[#E7EBF2] shadow-[0_8px_28px_rgba(0,0,0,0.12)] z-30 overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <input autoFocus type="text" placeholder="Search name or ID..."
                          value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-full border border-[#E7EBF2] outline-none focus:border-[#1559C7]"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {filtered.length === 0
                          ? <p className="text-center text-gray-500 text-sm py-5">No students found</p>
                          : filtered.map(s => (
                            <button key={s.id} type="button"
                              onClick={() => { setSelectedStudent(s); setShowDropdown(false); setStudentSearch(''); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1559C7]/[0.04] text-left transition-colors border-b border-gray-50 last:border-0"
                            >
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#1559C7] to-[#2a78d6] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-sm">
                                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-black text-sm">{s.name}</p>
                                <p className="text-xs text-gray-500">{s.olympiadCode}{s.className ? ` · ${s.className}` : ''}</p>
                              </div>
                            </button>
                          ))
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Slot status banner */}
              {selectedStudent && (
                <div className="mt-3">
                  {slotsLoading ? (
                    <div className="h-8 bg-gray-50 rounded-xl animate-pulse" />
                  ) : slots && (
                    isGeneralOnly ? (
                      <div className="flex items-center gap-2 bg-[#1559C7]/10 rounded-full px-3 py-2 text-xs text-[#1559C7] font-bold">
                        <CheckCircle className="w-3.5 h-3.5 text-[#1559C7] flex-shrink-0" />
                        Both olympiad slots filled — this video will go to General Feed
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {CATEGORIES.map((catInfo) => {
                          const status = getCatStatus(catInfo.value);
                          return (
                            <div key={catInfo.value} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              status === 'filled'    ? 'bg-[#0d9f6e]/10 text-[#0d9f6e]' :
                              status === 'rejected'  ? 'bg-red-50 text-red-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {status === 'filled'   && <CheckCircle className="w-3 h-3" />}
                              {status === 'rejected' && <RefreshCw className="w-3 h-3" />}
                              {catInfo.label} — {status === 'filled' ? 'Submitted' : status === 'rejected' ? 'Re-upload' : 'Pending'}
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Video drop zone */}
            <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2.5">
                Video File <span className="text-red-500">*</span>
              </p>

              {videoPreview ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    <video src={videoPreview} controls className="w-full max-h-64 object-contain" />
                    <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(null); setAspectMismatch(false); setAutoCrop(false); }}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <Video className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <p className="text-xs text-gray-600 truncate">{videoFile?.name}</p>
                    <span className="text-xs text-gray-500 flex-shrink-0">· {((videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>

                  {aspectMismatch && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5 text-red-600 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      This video is not in 9:16 (portrait) format. Enable auto-crop below, or upload a portrait video.
                    </div>
                  )}

                  <label className="flex items-center gap-2 px-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCrop}
                      onChange={e => setAutoCrop(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-[#1559C7]"
                    />
                    <span className="text-xs text-gray-600">Auto-crop to 9:16 if not already portrait</span>
                  </label>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                    dragOver ? 'border-[#1559C7] bg-[#1559C7]/5' : 'border-gray-300 hover:border-[#1559C7] hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-12 h-12 mx-auto mb-3 flex items-center justify-center rounded-2xl transition-all ${dragOver ? 'bg-gradient-to-br from-[#1559C7] to-[#2a78d6] text-white shadow-[0_4px_14px_rgba(21,89,199,0.3)]' : 'bg-gray-50 text-gray-500'}`}>
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-gray-700 text-sm mb-1">
                    {dragOver ? 'Drop it here' : 'Click to select or drag & drop'}
                  </p>
                  <p className="text-xs text-gray-500">MP4, MOV, AVI · 9:16 portrait · Max 2 min · Auto-compressed above 150 MB</p>
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2.5">Caption</p>
              <textarea
                value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Add a description for this video..."
                rows={3}
                className="w-full rounded-xl border border-[#E7EBF2] px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#1559C7] resize-none transition-colors"
              />
            </div>
          </div>

          {/* — RIGHT column (2/5) — */}
          <div className="xl:col-span-2 space-y-4">

            {/* Visibility */}
            <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2.5">Visibility</p>
              <div className="space-y-2">
                {[
                  { val: true,  icon: Globe,   label: 'Public',  desc: 'Anyone on Mittmee can see this video' },
                  { val: false, icon: EyeOff,  label: 'Private', desc: 'Only reviewers and school can see this video' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = isPublic === opt.val;
                  return (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => setIsPublic(opt.val)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                        active ? 'border-[#1559C7] bg-[#1559C7]/5' : 'border-[#E7EBF2] hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#1559C7]' : 'text-gray-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${active ? 'text-[#1559C7]' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${active ? 'border-[#1559C7] bg-[#1559C7]' : 'border-gray-300'}`}>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* General feed notice */}
            {isGeneralOnly && (
              <div className="bg-[#1559C7]/10 rounded-2xl p-4 text-sm">
                <p className="font-bold mb-1 text-xs uppercase tracking-wide text-[#1559C7]">General Feed Upload</p>
                <p className="text-xs text-[#1559C7]/80 leading-relaxed">
                  This student has 2 approved olympiad videos. Any further uploads will go to the general feed — not olympiad evaluation.
                </p>
              </div>
            )}

            {/* Category */}
            <div className={`bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] p-4 ${!canPickCategory ? 'opacity-50' : ''}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2.5">
                Category <span className="text-red-500">*</span>
              </p>
              {!canPickCategory && (
                <p className="text-xs text-gray-500 mb-2.5">
                  {selectedStudent ? 'Loading student details…' : 'Select a student first to choose a category.'}
                </p>
              )}
              <div className="space-y-2">
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
                      onClick={() => {
                        if (isDisabled) return;
                        setCategory(isSelected ? '' : cat.value);
                        setSubCategory(''); setCustomTalent('');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all ${
                        isFilled
                          ? 'border-[#0d9f6e]/30 bg-[#0d9f6e]/5 opacity-60 cursor-not-allowed'
                          : !canPickCategory
                            ? 'border-gray-200 cursor-not-allowed'
                            : isSelected
                              ? 'border-[#1559C7] bg-[#1559C7]/5'
                              : 'border-[#E7EBF2] hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {isFilled
                        ? <Lock className="w-4 h-4 text-[#0d9f6e] flex-shrink-0" />
                        : <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[#1559C7]' : 'text-gray-500'}`} />
                      }
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold leading-tight block ${
                          isFilled ? 'text-[#0d9f6e]' : isSelected ? 'text-[#1559C7]' : 'text-gray-700'
                        }`}>
                          {cat.label}
                        </span>
                        {isFilled && <span className="text-[11px] text-[#0d9f6e]">Already submitted</span>}
                        {isRejected && !isFilled && <span className="text-[11px] text-red-600 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> Re-upload available</span>}
                      </div>
                      {isFilled
                        ? <CheckCircle className="w-4 h-4 text-[#0d9f6e] flex-shrink-0" />
                        : isSelected
                          ? <CheckCircle className="w-4 h-4 text-[#1559C7] flex-shrink-0" />
                          : null
                      }
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategory */}
            {selectedCat && (
              <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2.5">
                  Sub Category <span className="text-red-500">*</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCat.subCategories.map(sub => (
                    <button key={sub} type="button" onClick={() => { setSubCategory(sub); if (sub !== 'Any Other Special Talent' && sub !== 'Any Other') setCustomTalent(''); }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${
                        subCategory === sub
                          ? 'bg-[#1559C7] text-white border-[#1559C7]'
                          : 'border-[#E7EBF2] text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>

                {isCustomTalent && (
                  <div className="mt-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                      {subCategory === 'Any Other' ? 'Topic' : 'Talent Name'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customTalent}
                      onChange={e => setCustomTalent(e.target.value)}
                      placeholder={subCategory === 'Any Other' ? 'Enter the topic...' : 'Enter the talent name...'}
                      autoFocus
                      className="w-full rounded-xl border border-[#E7EBF2] px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#1559C7] transition-colors"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 rounded-xl px-3.5 py-2.5 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            {/* Progress */}
            {(uploadState === 'uploading' || uploadState === 'saving') && (
              <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {uploadState === 'uploading' ? 'Uploading...' : 'Saving details...'}
                  </span>
                  <span className="text-sm font-bold text-[#1559C7]">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1559C7] to-[#2a78d6] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={uploadState === 'uploading' || uploadState === 'saving'}
              className="w-full bg-gradient-to-r from-[#1559C7] to-[#2a78d6] text-white py-3 text-sm font-bold rounded-full flex items-center justify-center gap-2.5 hover:shadow-[0_4px_14px_rgba(21,89,199,0.35)] transition-shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Upload className="w-4 h-4" />
              {uploadState === 'uploading' ? 'Uploading...' : uploadState === 'saving' ? 'Saving...' : 'Upload Video'}
            </button>
          </div>
        </div>
      </form>

      {showDropdown && <div className="fixed inset-0 z-20" onClick={() => setShowDropdown(false)} />}
    </div>
  );
}
