'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Video, X, CheckCircle, AlertCircle, User, Music, Palette, ChevronDown, Lock, RefreshCw, Globe, EyeOff } from 'lucide-react';
import { OLYMPIAD_CAT_A_SUBS, getCatBSubs } from '@/lib/olympiad-categories';

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

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress]     = useState(0);
  const [errorMsg, setErrorMsg]     = useState('');
  const [lastVideoMeta, setLastVideoMeta] = useState<{ isEvaluation: boolean; category: string; subCategory: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('schoolToken') || '' : '';

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
      label: 'Cat A – Performing Art, Dance & Music',
      value: 'Cat A',
      icon: Music,
      subCategories: OLYMPIAD_CAT_A_SUBS,
    },
    {
      label: selectedStudent?.classCode === 'U' ? 'Cat B – Speech / Talent Presentation' : 'Cat B – Rhymes Submission',
      value: 'Cat B',
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
    const isA = catValue === 'Cat A';
    const filled = isA ? slots.slotA : slots.slotB;
    const rejected = isA ? slots.rejectedA : slots.rejectedB;
    if (filled && !rejected) return 'filled';     // submitted (pending/approved)
    if (rejected) return 'rejected';               // rejected â†’ re-upload allowed
    return 'available';
  };

  function handleFile(file: File) {
    if (!file.type.startsWith('video/')) { setErrorMsg('Please select a valid video file.'); return; }
    if (file.size > 150 * 1024 * 1024) { setErrorMsg('Video must be under 150 MB.'); return; }
    setErrorMsg('');
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  }

  const isCustomTalent = subCategory === 'Any Other Special Talent';
  const finalSubCategory = isCustomTalent ? customTalent.trim() : subCategory;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !videoFile || !category || !subCategory) {
      setErrorMsg('Please fill all required fields and select a video.');
      return;
    }
    if (isCustomTalent && !customTalent.trim()) {
      setErrorMsg('Please enter the talent name.');
      return;
    }
    setErrorMsg('');
    setUploadState('uploading');
    setProgress(15);

    try {
      const fd = new FormData();
      fd.append('video', videoFile);
      fd.append('studentId', selectedStudent.id);

      const upRes = await fetch('/api/school/me/upload-video', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      setProgress(60);
      if (!upRes.ok) throw new Error((await upRes.json()).error || 'Upload failed');
      const { videoUrl, thumbnailUrl } = await upRes.json();

      setUploadState('saving');
      setProgress(80);

      const metaRes = await fetch('/api/school/me/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: selectedStudent.id, videoUrl, thumbnailUrl, caption, category, subCategory: finalSubCategory, isPublic }),
      });
      setProgress(100);
      if (!metaRes.ok) throw new Error((await metaRes.json()).error || 'Save failed');
      const saved = await metaRes.json();
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
    setUploadState('idle'); setProgress(0); setErrorMsg(''); setLastVideoMeta(null);
    setSlots(null);
  }

  /* — Done screen — */
  if (uploadState === 'done') {
    const isEval = lastVideoMeta?.isEvaluation ?? true;
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white border border-gray-300 shadow-lg p-10 text-center max-w-md w-full">
          <div className="w-16 h-16 border border-green-300 bg-green-50 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-green-700" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Video Uploaded</h2>
          <p className="text-gray-600 text-sm mb-5">
            For <span className="font-semibold text-gray-800">{selectedStudent?.name}</span>
            {lastVideoMeta?.subCategory ? ` · ${lastVideoMeta.subCategory}` : ''}
          </p>

          {isEval ? (
            <div className="mx-auto mb-5 inline-flex flex-col items-center gap-1.5 bg-[#F4F5F7] border border-gray-300 px-6 py-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Video Type</span>
              <span className="text-base font-bold text-[#06013E]">Olympiad Evaluation</span>
              <p className="text-xs text-gray-500 leading-snug max-w-[220px]">
                This video will be reviewed and scored as an olympiad participation entry.
              </p>
            </div>
          ) : (
            <div className="mx-auto mb-5 inline-flex flex-col items-center gap-1.5 bg-gray-50 border border-gray-300 px-6 py-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Video Type</span>
              <span className="text-base font-bold text-blue-700">General Feed</span>
              <p className="text-xs text-gray-500 leading-snug max-w-[240px]">
                This student already has 2 approved olympiad videos. This video will appear in the general public feed only.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-500 mb-7">Status will update after admin review.</p>
          <button onClick={reset} className="bg-[#2357D8] text-white px-6 py-2.5 text-sm font-semibold rounded-full hover:bg-[#1D4ED8] transition-colors">
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  /* — Main — */
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-300">
        <div className="flex items-center px-4 py-2.5 border-b border-gray-300 bg-[#F4F5F7]">
          <Upload size={15} className="text-[#06013E] mr-2" />
          <h1 className="text-[13px] font-bold text-[#06013E] uppercase tracking-wide">Upload Student Video</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">

          {/* — LEFT column (3/5) — */}
          <div className="xl:col-span-3 space-y-3">

            {/* Student selector */}
            <div className="bg-white border border-gray-300 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-2.5">
                Select Student <span className="text-red-600">*</span>
              </p>

              {loadingStudents ? (
                <div className="h-11 bg-gray-50 border border-gray-300 animate-pulse" />
              ) : students.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-gray-300 text-gray-500 text-sm">
                  <User className="w-4 h-4" /> No registered students found
                </div>
              ) : (
                <div className="relative">
                  <div
                    onClick={() => setShowDropdown(v => !v)}
                    className="flex items-center gap-3 border border-gray-300 px-4 py-2.5 cursor-pointer hover:border-[#06013E] transition-colors bg-white"
                  >
                    {selectedStudent ? (
                      <>
                        <div className="w-8 h-8 border border-gray-300 bg-[#F4F5F7] text-[#06013E] flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {selectedStudent.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{selectedStudent.name}</p>
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
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-400 shadow-lg z-30 overflow-hidden">
                      <div className="p-2 border-b border-gray-200">
                        <input autoFocus type="text" placeholder="Search name or ID..."
                          value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 outline-none focus:border-[#06013E]"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {filtered.length === 0
                          ? <p className="text-center text-gray-500 text-sm py-5">No students found</p>
                          : filtered.map(s => (
                            <button key={s.id} type="button"
                              onClick={() => { setSelectedStudent(s); setShowDropdown(false); setStudentSearch(''); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left transition-colors border-b border-gray-100 last:border-0"
                            >
                              <div className="w-7 h-7 border border-gray-300 bg-[#F4F5F7] text-[#06013E] flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{s.name}</p>
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
                    <div className="h-8 bg-gray-50 border border-gray-300 animate-pulse" />
                  ) : slots && (
                    isGeneralOnly ? (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-300 px-3 py-2 text-xs text-blue-700 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                        Both olympiad slots filled — this video will go to General Feed
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {(['Cat A', 'Cat B'] as const).map((cat) => {
                          const status = getCatStatus(cat);
                          return (
                            <div key={cat} className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold border ${
                              status === 'filled'    ? 'bg-green-50 border-green-300 text-green-700' :
                              status === 'rejected'  ? 'bg-red-50 border-red-300 text-red-700' :
                              'bg-gray-50 border-gray-300 text-gray-600'
                            }`}>
                              {status === 'filled'   && <CheckCircle className="w-3 h-3" />}
                              {status === 'rejected' && <RefreshCw className="w-3 h-3" />}
                              {cat} — {status === 'filled' ? 'Submitted' : status === 'rejected' ? 'Re-upload' : 'Pending'}
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
            <div className="bg-white border border-gray-300 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-2.5">
                Video File <span className="text-red-600">*</span>
              </p>

              {videoPreview ? (
                <div className="relative border border-gray-300 overflow-hidden bg-black">
                  <video src={videoPreview} controls className="w-full max-h-64 object-contain" />
                  <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                    className="absolute top-2 right-2 bg-black/60 text-white p-1.5 hover:bg-black/80 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="mt-2 flex items-center gap-2 px-1">
                    <Video className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <p className="text-xs text-gray-600 truncate">{videoFile?.name}</p>
                    <span className="text-xs text-gray-500 flex-shrink-0">· {((videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                    dragOver ? 'border-[#06013E] bg-[#F4F5F7]' : 'border-gray-300 hover:border-[#06013E] hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-12 h-12 mx-auto mb-3 flex items-center justify-center border transition-all ${dragOver ? 'bg-[#06013E] text-white border-[#06013E]' : 'bg-gray-50 text-gray-500 border-gray-300'}`}>
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="font-semibold text-gray-700 text-sm mb-1">
                    {dragOver ? 'Drop it here' : 'Click to select or drag & drop'}
                  </p>
                  <p className="text-xs text-gray-500">MP4, MOV, AVI · Max 150 MB</p>
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="bg-white border border-gray-300 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-2.5">Caption</p>
              <textarea
                value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Add a description for this video..."
                rows={3}
                className="w-full border border-gray-300 px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#06013E] resize-none transition-colors"
              />
            </div>
          </div>

          {/* — RIGHT column (2/5) — */}
          <div className="xl:col-span-2 space-y-3">

            {/* Visibility */}
            <div className="bg-white border border-gray-300 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-2.5">Visibility</p>
              <div className="space-y-2">
                {[
                  { val: true,  icon: Globe,   label: 'Public',  desc: 'Anyone on TalentOlympiad can see this video' },
                  { val: false, icon: EyeOff,  label: 'Private', desc: 'Only reviewers and school can see this video' },
                ].map(opt => {
                  const Icon = opt.icon;
                  const active = isPublic === opt.val;
                  return (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => setIsPublic(opt.val)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-all ${
                        active ? 'border-[#06013E] bg-[#F4F5F7]' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${active ? 'text-[#06013E]' : 'text-gray-700'}`}>{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${active ? 'border-[#06013E] bg-[#06013E]' : 'border-gray-300'}`}>
                        {active && <div className="w-1.5 h-1.5 bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* General feed notice */}
            {isGeneralOnly && (
              <div className="bg-blue-50 border border-blue-300 p-3.5 text-sm text-blue-700">
                <p className="font-bold mb-1 text-xs uppercase tracking-wide">General Feed Upload</p>
                <p className="text-xs text-blue-700 leading-relaxed">
                  This student has 2 approved olympiad videos. Any further uploads will go to the general feed — not olympiad evaluation.
                </p>
              </div>
            )}

            {/* Category */}
            <div className={`bg-white border border-gray-300 p-4 ${!canPickCategory ? 'opacity-50' : ''}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-2.5">
                Category <span className="text-red-600">*</span>
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
                      className={`w-full flex items-center gap-3 px-3 py-3 border text-left transition-all ${
                        isFilled
                          ? 'border-green-300 bg-green-50 opacity-60 cursor-not-allowed'
                          : !canPickCategory
                            ? 'border-gray-200 cursor-not-allowed'
                            : isSelected
                              ? 'border-[#06013E] bg-[#F4F5F7]'
                              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {isFilled
                        ? <Lock className="w-4 h-4 text-green-700 flex-shrink-0" />
                        : <Icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                      }
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold leading-tight block ${
                          isFilled ? 'text-green-700' : isSelected ? 'text-[#06013E]' : 'text-gray-700'
                        }`}>
                          {cat.label}
                        </span>
                        {isFilled && <span className="text-[11px] text-green-700">Already submitted</span>}
                        {isRejected && !isFilled && <span className="text-[11px] text-red-700 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> Re-upload available</span>}
                      </div>
                      {isFilled
                        ? <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0" />
                        : isSelected
                          ? <CheckCircle className="w-4 h-4 text-[#06013E] flex-shrink-0" />
                          : null
                      }
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategory */}
            {selectedCat && (
              <div className="bg-white border border-gray-300 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-2.5">
                  Sub Category <span className="text-red-600">*</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCat.subCategories.map(sub => (
                    <button key={sub} type="button" onClick={() => { setSubCategory(sub); if (sub !== 'Any Other Special Talent') setCustomTalent(''); }}
                      className={`px-2.5 py-1.5 text-xs font-semibold border transition-all ${
                        subCategory === sub
                          ? 'bg-[#06013E] text-white border-[#06013E]'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>

                {isCustomTalent && (
                  <div className="mt-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                      Talent Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={customTalent}
                      onChange={e => setCustomTalent(e.target.value)}
                      placeholder="Enter the talent name..."
                      autoFocus
                      className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-[#06013E] transition-colors"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-300 px-3.5 py-2.5 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            {/* Progress */}
            {(uploadState === 'uploading' || uploadState === 'saving') && (
              <div className="bg-white border border-gray-300 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {uploadState === 'uploading' ? 'Uploading...' : 'Saving details...'}
                  </span>
                  <span className="text-sm font-bold text-[#06013E]">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 border border-gray-300 overflow-hidden">
                  <div
                    className="h-full bg-[#06013E] transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={uploadState === 'uploading' || uploadState === 'saving'}
              className="w-full bg-[#2357D8] text-white py-3 text-sm font-semibold rounded-full flex items-center justify-center gap-2.5 hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
