'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Video, X, CheckCircle, AlertCircle, User, Music, Palette, ChevronDown, Lock, RefreshCw } from 'lucide-react';
import { OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_B_SUBS } from '@/lib/olympiad-categories';

const CATEGORIES = [
  {
    label: 'Cat A – Performing Art, Dance & Music',
    value: 'Cat A',
    icon: Music,
    subCategories: OLYMPIAD_CAT_A_SUBS,
  },
  {
    label: 'Cat B – Creative Art & Communication',
    value: 'Cat B',
    icon: Palette,
    subCategories: OLYMPIAD_CAT_B_SUBS,
  },
];

type Student = { id: string; name: string; olympiadCode: string; className: string | null; classCode: string | null; source?: string };
type UploadState = 'idle' | 'uploading' | 'saving' | 'done' | 'error';
type Slots = { slotA: boolean; slotB: boolean; rejectedA: boolean; rejectedB: boolean; approvedCount: number };

const AVATAR_COLORS = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-rose-500','bg-amber-500','bg-cyan-500'];

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
  const [caption, setCaption]       = useState('');

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
    setCategory(''); setSubCategory('');
  }, [selectedStudent, token]);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.olympiadCode.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const selectedCat = CATEGORIES.find(c => c.value === category);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudent || !videoFile || !category || !subCategory) {
      setErrorMsg('Please fill all required fields and select a video.');
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
      const { videoUrl } = await upRes.json();

      setUploadState('saving');
      setProgress(80);

      const metaRes = await fetch('/api/school/me/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId: selectedStudent.id, videoUrl, caption, category, subCategory, isPublic: true }),
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
    setCategory(''); setSubCategory(''); setCaption('');
    setUploadState('idle'); setProgress(0); setErrorMsg(''); setLastVideoMeta(null);
    setSlots(null);
  }

  /* â”€â”€ Done screen â”€â”€ */
  if (uploadState === 'done') {
    const isEval = lastVideoMeta?.isEvaluation ?? true;
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 text-center max-w-md w-full border border-gray-100">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-1">Video Uploaded!</h2>
          <p className="text-gray-500 text-sm mb-5">
            For <span className="font-semibold text-gray-800">{selectedStudent?.name}</span>
            {lastVideoMeta?.subCategory ? ` Â· ${lastVideoMeta.subCategory}` : ''}
          </p>

          {isEval ? (
            <div className="mx-auto mb-5 inline-flex flex-col items-center gap-2 bg-[#06013E]/5 border border-[#06013E]/20 rounded-2xl px-6 py-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#004f9f]/50">Video Type</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF9000] animate-pulse flex-shrink-0" />
                <span className="text-base font-black text-[#004f9f]">Olympiad Evaluation</span>
              </div>
              <p className="text-xs text-gray-400 leading-snug max-w-[220px]">
                This video will be reviewed and scored as an olympiad participation entry.
              </p>
            </div>
          ) : (
            <div className="mx-auto mb-5 inline-flex flex-col items-center gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-4">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Video Type</span>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span className="text-base font-black text-blue-700">General Feed</span>
              </div>
              <p className="text-xs text-gray-400 leading-snug max-w-[240px]">
                This student already has 2 approved olympiad videos. This video will appear in the general public feed only.
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 mb-7">Status will update after admin review.</p>
          <button onClick={reset} className="bg-[#06013E] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#0a0258] transition-colors">
            Upload Another
          </button>
        </div>
      </div>
    );
  }

  /* â”€â”€ Main â”€â”€ */
  return (
    <div className="min-h-screen bg-[#F6F9FF]">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

          {/* â”€â”€ LEFT column (3/5) â”€â”€ */}
          <div className="xl:col-span-3 space-y-5">

            {/* Student selector */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">
                Select Student <span className="text-red-400">*</span>
              </p>

              {loadingStudents ? (
                <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ) : students.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-gray-400 text-sm">
                  <User className="w-4 h-4" /> No registered students found
                </div>
              ) : (
                <div className="relative">
                  <div
                    onClick={() => setShowDropdown(v => !v)}
                    className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-[#06013E]/30 transition-colors bg-white"
                  >
                    {selectedStudent ? (
                      <>
                        <div className={`w-9 h-9 rounded-full ${AVATAR_COLORS[selectedStudent.name.charCodeAt(0) % AVATAR_COLORS.length]} text-white flex items-center justify-center font-black text-xs flex-shrink-0`}>
                          {selectedStudent.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{selectedStudent.name}</p>
                          <p className="text-xs text-gray-400">{selectedStudent.olympiadCode}{selectedStudent.className ? ` Â· ${selectedStudent.className}` : ''}</p>
                        </div>
                        <button type="button" onClick={e => { e.stopPropagation(); setSelectedStudent(null); }} className="text-gray-300 hover:text-gray-500 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-gray-300" />
                        <span className="text-gray-400 text-sm flex-1">Choose a student...</span>
                        <ChevronDown className="w-4 h-4 text-gray-300" />
                      </>
                    )}
                  </div>

                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 overflow-hidden">
                      <div className="p-2 border-b border-gray-50">
                        <input autoFocus type="text" placeholder="Search name or ID..."
                          value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-[#06013E]/40"
                        />
                      </div>
                      <div className="max-h-56 overflow-y-auto">
                        {filtered.length === 0
                          ? <p className="text-center text-gray-400 text-sm py-5">No students found</p>
                          : filtered.map(s => (
                            <button key={s.id} type="button"
                              onClick={() => { setSelectedStudent(s); setShowDropdown(false); setStudentSearch(''); }}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F6F9FF] text-left transition-colors"
                            >
                              <div className={`w-8 h-8 rounded-full ${AVATAR_COLORS[s.name.charCodeAt(0) % AVATAR_COLORS.length]} text-white flex items-center justify-center font-black text-xs flex-shrink-0`}>
                                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{s.name}</p>
                                <p className="text-xs text-gray-400">{s.olympiadCode}{s.className ? ` Â· ${s.className}` : ''}</p>
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
                    <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                  ) : slots && (
                    isGeneralOnly ? (
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        Both olympiad slots filled â€” this video will go to General Feed
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {(['Cat A', 'Cat B'] as const).map((cat) => {
                          const status = getCatStatus(cat);
                          return (
                            <div key={cat} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              status === 'filled'    ? 'bg-green-50 border-green-200 text-green-700' :
                              status === 'rejected'  ? 'bg-red-50 border-red-200 text-red-600' :
                              'bg-gray-50 border-gray-200 text-gray-500'
                            }`}>
                              {status === 'filled'   && <CheckCircle className="w-3 h-3" />}
                              {status === 'rejected' && <RefreshCw className="w-3 h-3" />}
                              {status === 'available' && <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />}
                              {cat} â€” {status === 'filled' ? 'Submitted' : status === 'rejected' ? 'Re-upload' : 'Pending'}
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
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">
                Video File <span className="text-red-400">*</span>
              </p>

              {videoPreview ? (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  <video src={videoPreview} controls className="w-full max-h-64 object-contain" />
                  <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                  <div className="mt-2 flex items-center gap-2 px-1">
                    <Video className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <p className="text-xs text-gray-500 truncate">{videoFile?.name}</p>
                    <span className="text-xs text-gray-400 flex-shrink-0">Â· {((videoFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                    dragOver ? 'border-[#06013E] bg-[#06013E]/5 scale-[1.01]' : 'border-gray-200 hover:border-[#06013E]/30 hover:bg-[#F6F9FF]'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${dragOver ? 'bg-[#06013E] text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-gray-600 text-sm mb-1">
                    {dragOver ? 'Drop it here!' : 'Click to select or drag & drop'}
                  </p>
                  <p className="text-xs text-gray-400">MP4, MOV, AVI Â· Max 150 MB</p>
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">Caption</p>
              <textarea
                value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Add a description for this video..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 outline-none focus:border-[#06013E]/40 resize-none transition-colors"
              />
            </div>
          </div>

          {/* â”€â”€ RIGHT column (2/5) â”€â”€ */}
          <div className="xl:col-span-2 space-y-5">

            {/* General feed notice */}
            {isGeneralOnly && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
                <p className="font-bold mb-1">General Feed Upload</p>
                <p className="text-xs text-blue-500 leading-relaxed">
                  This student has 2 approved olympiad videos. Any further uploads will go to the general feed â€” not olympiad evaluation.
                </p>
              </div>
            )}

            {/* Category */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-700 mb-3">
                Category <span className="text-red-400">*</span>
              </p>
              <div className="space-y-3">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.value;
                  const status = getCatStatus(cat.value);
                  const isFilled = status === 'filled';
                  const isRejected = status === 'rejected';

                  return (
                    <button
                      key={cat.value}
                      type="button"
                      disabled={isFilled}
                      onClick={() => {
                        if (isFilled) return;
                        setCategory(isSelected ? '' : cat.value);
                        setSubCategory('');
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                        isFilled
                          ? 'border-green-200 bg-green-50 opacity-60 cursor-not-allowed'
                          : isSelected
                            ? 'border-[#06013E] bg-[#06013E]/5'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isFilled ? 'bg-green-100' : cat.value === 'Cat A' ? 'bg-purple-100' : 'bg-orange-100'
                      }`}>
                        {isFilled
                          ? <Lock className="w-4 h-4 text-green-600" />
                          : <Icon className={`w-4 h-4 ${cat.value === 'Cat A' ? 'text-purple-600' : 'text-orange-500'}`} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold leading-tight block ${
                          isFilled ? 'text-green-700' : isSelected ? 'text-[#004f9f]' : 'text-gray-600'
                        }`}>
                          {cat.label}
                        </span>
                        {isFilled && <span className="text-[11px] text-green-600">Already submitted</span>}
                        {isRejected && !isFilled && <span className="text-[11px] text-red-500 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5" /> Re-upload available</span>}
                      </div>
                      {isFilled
                        ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        : isSelected
                          ? <div className="w-5 h-5 rounded-full bg-[#06013E] flex items-center justify-center flex-shrink-0">
                              <CheckCircle className="w-3 h-3 text-white" />
                            </div>
                          : null
                      }
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategory */}
            {selectedCat && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-gray-700 mb-3">
                  Sub Category <span className="text-red-400">*</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedCat.subCategories.map(sub => (
                    <button key={sub} type="button" onClick={() => setSubCategory(sub)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        subCategory === sub
                          ? 'bg-[#06013E] text-white border-[#06013E]'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {errorMsg && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            {/* Progress */}
            {(uploadState === 'uploading' || uploadState === 'saving') && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {uploadState === 'uploading' ? 'Uploading...' : 'Saving details...'}
                  </span>
                  <span className="text-sm font-bold text-[#004f9f]">{progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#06013E] to-[#FF9000] rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={uploadState === 'uploading' || uploadState === 'saving'}
              className="w-full bg-[#06013E] text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 hover:bg-[#0a0258] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#06013E]/20"
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

