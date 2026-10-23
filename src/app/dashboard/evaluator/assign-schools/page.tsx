'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Loader2, CheckCircle, AlertCircle, UserCheck, X } from 'lucide-react';

interface School {
  id: string;
  schoolId: string;
  name: string;
  city: string | null;
  district: string | null;
  state: string | null;
  isActive: boolean;
  evaluatorIds: string[];
  videos: number;
  pending: number;
}
interface Evaluator { id: string; evaluatorId: string; name: string; isActive: boolean }

const PAGE = 200;

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AssignSchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [assignFilter, setAssignFilter] = useState(''); // '' | 'none' | 'any' | 'multi' | <evaluator id>
  const [videosOnly, setVideosOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const [selectedSchools, setSelectedSchools] = useState<Set<string>>(new Set());
  const [selectedEvals, setSelectedEvals] = useState<Set<string>>(new Set());
  const [exclusive, setExclusive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch('/api/evaluator/assignments', { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setSchools(data.schools);
      setEvaluators(data.evaluators);
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const evalName = useMemo(() => new Map(evaluators.map(e => [e.id, e.name])), [evaluators]);
  const states = useMemo(() => [...new Set(schools.map(s => s.state).filter(Boolean) as string[])].sort(), [schools]);
  const districts = useMemo(
    () => [...new Set(schools.filter(s => !state || s.state === state).map(s => s.district).filter(Boolean) as string[])].sort(),
    [schools, state],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter(s => {
      if (q && !(s.name.toLowerCase().includes(q) || s.schoolId.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q))) return false;
      if (state && s.state !== state) return false;
      if (district && s.district !== district) return false;
      if (videosOnly && s.videos === 0) return false;
      if (assignFilter === 'none') return s.evaluatorIds.length === 0;
      if (assignFilter === 'any') return s.evaluatorIds.length > 0;
      if (assignFilter === 'multi') return s.evaluatorIds.length > 1;
      if (assignFilter) return s.evaluatorIds.includes(assignFilter);
      return true;
    });
  }, [schools, search, state, district, videosOnly, assignFilter]);

  useEffect(() => { setLimit(PAGE); }, [search, state, district, videosOnly, assignFilter]);

  const evalLoad = useMemo(() => {
    const m = new Map<string, { schools: number; pending: number }>();
    for (const s of schools) for (const id of s.evaluatorIds) {
      const cur = m.get(id) || { schools: 0, pending: 0 };
      m.set(id, { schools: cur.schools + 1, pending: cur.pending + s.pending });
    }
    return m;
  }, [schools]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(s => selectedSchools.has(s.id));
  const toggleAll = () => setSelectedSchools(prev => {
    const next = new Set(prev);
    if (allFilteredSelected) filtered.forEach(s => next.delete(s.id));
    else filtered.forEach(s => next.add(s.id));
    return next;
  });
  const toggleSchool = (id: string) => setSelectedSchools(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleEval = (id: string) => setSelectedEvals(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submit = async (mode: 'add' | 'replace' | 'remove', evaluatorIds: string[]) => {
    setBusy(true);
    try {
      const res = await fetch('/api/evaluator/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ mode, schoolIds: [...selectedSchools], evaluatorIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      await load();
      setToast({ ok: true, text: `Saved for ${selectedSchools.size} school${selectedSchools.size === 1 ? '' : 's'}` });
      setSelectedSchools(new Set());
    } catch (e: any) {
      setToast({ ok: false, text: e.message });
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const assign = () => submit(exclusive ? 'replace' : 'add', [...selectedEvals]);
  const unassign = () => submit('remove', [...selectedEvals]);
  const clearAll = () => {
    if (!confirm(`Remove ALL evaluators from ${selectedSchools.size} selected school(s)? Their videos will then be visible to no evaluator.`)) return;
    submit('replace', []);
  };

  const noSchools = selectedSchools.size === 0;
  const noEvals = selectedEvals.size === 0;
  const unassignedCount = schools.filter(s => s.evaluatorIds.length === 0).length;
  const multiCount = schools.filter(s => s.evaluatorIds.length > 1).length;
  const sel = 'border border-gray-200 rounded-lg px-2.5 py-2 text-sm bg-white focus:outline-none focus:border-[#004f9f]';

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-medium text-[#004f9f]">Assign Schools to Evaluators</h1>
        <p className="text-xs text-gray-500 mt-1">
          An evaluator sees only the videos of the schools assigned to them. Filter the schools, tick them, pick the evaluators on the right, and press Assign.
        </p>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
      ) : loadError ? (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle size={15} /> {loadError}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* Schools */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search school name, ID, city..." value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#004f9f]" />
                </div>
                <select className={sel} value={state} onChange={e => { setState(e.target.value); setDistrict(''); }}>
                  <option value="">All states</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className={sel} value={district} onChange={e => setDistrict(e.target.value)}>
                  <option value="">All districts</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select className={sel} value={assignFilter} onChange={e => setAssignFilter(e.target.value)}>
                  <option value="">Any assignment</option>
                  <option value="none">Unassigned ({unassignedCount})</option>
                  <option value="any">Assigned</option>
                  <option value="multi">Given to 2+ evaluators ({multiCount})</option>
                  {evaluators.map(e => <option key={e.id} value={e.id}>Of {e.name}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 px-1">
                  <input type="checkbox" checked={videosOnly} onChange={e => setVideosOnly(e.target.checked)} /> Only schools with videos
                </label>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <label className="flex items-center gap-2 font-semibold text-gray-700">
                  <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
                  Select all {filtered.length} shown
                </label>
                <span>{selectedSchools.size} selected{selectedSchools.size > 0 && (
                  <button onClick={() => setSelectedSchools(new Set())} className="ml-2 text-[#004f9f] hover:underline">clear</button>
                )}</span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-100 text-gray-400">
                    <th className="w-10 px-3 py-2.5" />
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase">School</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase">Location</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase">Pending / Videos</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase">Evaluators</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map(s => (
                    <tr key={s.id} onClick={() => toggleSchool(s.id)}
                      className={`border-b border-gray-50 cursor-pointer ${selectedSchools.has(s.id) ? 'bg-blue-50/60' : 'hover:bg-gray-50/60'}`}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedSchools.has(s.id)} onChange={() => toggleSchool(s.id)} onClick={e => e.stopPropagation()} /></td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-gray-800">{s.name}</p>
                        <p className="text-[11px] font-mono text-gray-400">{s.schoolId}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{[s.city, s.district, s.state].filter(Boolean).join(', ') || '-'}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-gray-600">{s.videos ? `${s.pending} / ${s.videos}` : '-'}</td>
                      <td className="px-3 py-2">
                        {s.evaluatorIds.length === 0 ? (
                          <span className="text-[11px] text-amber-600 italic">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {s.evaluatorIds.map(id => (
                              <span key={id} className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full border ${s.evaluatorIds.length > 1 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                {evalName.get(id) || 'Unknown'}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="py-16 text-center text-gray-400 text-sm">No schools match these filters.</td></tr>
                  )}
                </tbody>
              </table>
              {filtered.length > limit && (
                <div className="p-3 text-center">
                  <button onClick={() => setLimit(l => l + PAGE)} className="text-xs font-semibold text-[#004f9f] hover:underline">
                    Show more ({filtered.length - limit} left; selection already covers all {filtered.length})
                  </button>
                </div>
              )}
            </div>
            {multiCount > 0 && (
              <p className="px-4 py-2 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-100">
                Amber names = the school is given to 2+ evaluators, so they can pick the same video. Use "Only these evaluators" to keep one owner per school.
              </p>
            )}
          </div>

          {/* Evaluators */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden lg:sticky lg:top-4">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <UserCheck size={15} className="text-[#004f9f]" />
              <p className="text-sm font-bold text-gray-800">Evaluators</p>
              <span className="ml-auto text-xs text-gray-400">{selectedEvals.size} picked</span>
            </div>
            <div className="max-h-[42vh] overflow-y-auto divide-y divide-gray-50">
              {evaluators.length === 0 && <p className="p-4 text-xs text-gray-400">No evaluators yet. Create one in Manage Evaluators.</p>}
              {evaluators.map(e => {
                const load = evalLoad.get(e.id);
                return (
                  <label key={e.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${selectedEvals.has(e.id) ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={selectedEvals.has(e.id)} onChange={() => toggleEval(e.id)} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${e.isActive ? 'text-gray-800' : 'text-gray-400'}`}>{e.name}{!e.isActive && ' (inactive)'}</p>
                      <p className="text-[11px] text-gray-400">{load ? `${load.schools} schools · ${load.pending} pending` : 'No schools yet'}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="p-4 border-t border-gray-100 space-y-3">
              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input type="checkbox" className="mt-0.5" checked={exclusive} onChange={e => setExclusive(e.target.checked)} />
                <span><b>Only these evaluators</b> — remove the selected schools from everyone else (no duplicate work).</span>
              </label>
              <button onClick={assign} disabled={busy || noSchools || noEvals}
                className="w-full py-2.5 bg-[#004f9f] text-white text-sm font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-40 flex items-center justify-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin" />}
                Assign {noSchools ? '' : `${selectedSchools.size} school${selectedSchools.size === 1 ? '' : 's'}`} to {noEvals ? 'evaluators' : `${selectedEvals.size} evaluator${selectedEvals.size === 1 ? '' : 's'}`}
              </button>
              <div className="flex gap-2">
                <button onClick={unassign} disabled={busy || noSchools || noEvals}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 disabled:opacity-40">
                  Remove picked evaluators
                </button>
                <button onClick={clearAll} disabled={busy || noSchools}
                  className="flex-1 py-2 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-40">
                  Clear all evaluators
                </button>
              </div>
              {(noSchools || noEvals) && (
                <p className="text-[11px] text-gray-400">
                  {noSchools ? 'Tick the schools on the left.' : 'Pick at least one evaluator.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.ok ? 'bg-[#009846]' : 'bg-red-600'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {toast.text}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}
