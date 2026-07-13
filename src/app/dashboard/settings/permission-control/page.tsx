'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, AlertCircle, ChevronDown, Eye, EyeOff, User, Globe, Trash2 } from 'lucide-react';

type RoleKey = 'REVIEWER' | 'EVALUATOR' | 'MODERATOR';
type ViewMode = 'global' | 'individual';

interface SubItem { key: string; label: string; }
interface Module { key: string; label: string; subItems: SubItem[]; }

const MODULES: Module[] = [
  { key: 'schools', label: 'Schools', subItems: [{ key: 'schools.register', label: 'Register School' }, { key: 'schools.bulk', label: 'Bulk Upload' }, { key: 'schools.view', label: 'View / Edit Schools' }] },
  { key: 'moderation', label: 'Moderation', subItems: [{ key: 'moderation.pending', label: 'Pending Approvals' }, { key: 'moderation.reported', label: 'Reported Videos' }, { key: 'moderation.moderators', label: 'Create Moderator' }] },
  { key: 'support', label: 'Support', subItems: [] },
  { key: 'uploaders', label: 'Uploaders', subItems: [{ key: 'uploaders.register', label: 'Register Uploader' }, { key: 'uploaders.view', label: 'View / Manage Uploaders' }] },
  { key: 'credentials', label: 'Credentials', subItems: [{ key: 'credentials.schools', label: 'School Credentials' }, { key: 'credentials.uploaders', label: 'Uploader Credentials' }, { key: 'credentials.students', label: 'Student Credentials' }, { key: 'credentials.reviewers', label: 'Reviewer Credentials' }, { key: 'credentials.evaluators', label: 'Evaluator Credentials' }] },
  { key: 'reviewer', label: 'Reviewer', subItems: [{ key: 'reviewer.manage', label: 'Manage Reviewers' }, { key: 'reviewer.content', label: 'Review Content' }] },
  { key: 'evaluator', label: 'Evaluator', subItems: [{ key: 'evaluator.manage', label: 'Manage Evaluators' }, { key: 'evaluator.content', label: 'Evaluate Content' }, { key: 'evaluator.history', label: 'Evaluation History' }] },
  { key: 'reports', label: 'Reports', subItems: [{ key: 'reports.students', label: 'Student Report' }, { key: 'reports.olympiad', label: 'Olympiad Completions' }, { key: 'reports.evaluation-progress', label: 'Evaluation Progress' }, { key: 'reports.schools', label: 'School Report' }, { key: 'reports.appusers', label: 'App Users' }] },
];

const ROLES: { key: RoleKey; label: string }[] = [
  { key: 'REVIEWER', label: 'Reviewer' },
  { key: 'EVALUATOR', label: 'Evaluator' },
  { key: 'MODERATOR', label: 'Moderator' },
];

const roleLabel = (role: RoleKey) => ROLES.find(r => r.key === role)?.label || role;

interface Member { id: string; name: string; reviewerId?: string; evaluatorId?: string; moderatorId?: string; }
interface IndividualPerm { memberId: string; allowedModules: string[]; reviewer?: Member; evaluator?: Member; moderator?: Member; }

function ModuleList({
  allowed, setAllowed, search,
}: {
  allowed: string[];
  setAllowed: (next: string[]) => void;
  search: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const toggleModule = (mod: Module) => {
    const isOn = allowed.includes(mod.key);
    if (isOn) setAllowed(allowed.filter(k => k !== mod.key && !mod.subItems.some(s => s.key === k)));
    else { const toAdd = [mod.key, ...mod.subItems.map(s => s.key)].filter(k => !allowed.includes(k)); setAllowed([...allowed, ...toAdd]); }
  };

  const toggleSubItem = (mod: Module, sub: SubItem) => {
    const isOn = allowed.includes(sub.key);
    if (isOn) {
      const next = allowed.filter(k => k !== sub.key);
      const anyLeft = mod.subItems.some(s => s.key !== sub.key && next.includes(s.key));
      setAllowed(anyLeft ? next : next.filter(k => k !== mod.key));
    } else {
      setAllowed([...allowed, sub.key, ...(!allowed.includes(mod.key) ? [mod.key] : [])]);
    }
  };

  const filtered = search.trim()
    ? MODULES.filter(m => m.label.toLowerCase().includes(search.toLowerCase()) || m.subItems.some(s => s.label.toLowerCase().includes(search.toLowerCase())))
    : MODULES;

  return (
    <div className="divide-y divide-gray-50">
      {filtered.map(mod => {
        const isOn = allowed.includes(mod.key);
        const isExpanded = expanded.has(mod.key);
        const enabledSubCount = mod.subItems.filter(s => allowed.includes(s.key)).length;
        return (
          <div key={mod.key}>
            <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${isOn ? 'bg-white' : 'bg-gray-50/50'}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-black ${isOn ? 'bg-[#004f9f]/10 text-[#004f9f]' : 'bg-gray-100 text-gray-400'}`}>
                {mod.label.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${isOn ? 'text-gray-800' : 'text-gray-400'}`}>{mod.label}</p>
                {mod.subItems.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{isOn ? `${enabledSubCount}/${mod.subItems.length} sub-items enabled` : 'Disabled'}</p>
                )}
              </div>
              {mod.subItems.length > 0 && (
                <button onClick={() => toggleExpand(mod.key)} className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors">
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
              <button onClick={() => toggleModule(mod)}
                className={`p-1.5 rounded-lg transition-colors ${isOn ? 'text-[#004f9f] bg-[#004f9f]/10 hover:bg-[#004f9f]/20' : 'text-gray-300 bg-gray-100 hover:bg-gray-200'}`}>
                {isOn ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
            {mod.subItems.length > 0 && (
              <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-80' : 'max-h-0'}`}>
                <div className="bg-gray-50/80 border-t border-gray-100">
                  {mod.subItems.map((sub, idx) => {
                    const subOn = allowed.includes(sub.key);
                    return (
                      <div key={sub.key} className={`flex items-center gap-4 pl-16 pr-5 py-3 ${idx < mod.subItems.length - 1 ? 'border-b border-gray-100' : ''}`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                        <p className={`flex-1 text-xs font-medium ${subOn ? 'text-gray-700' : 'text-gray-400'}`}>{sub.label}</p>
                        <button onClick={() => toggleSubItem(mod, sub)}
                          className={`p-1.5 rounded-lg transition-colors ${subOn ? 'text-[#004f9f] bg-[#004f9f]/10 hover:bg-[#004f9f]/20' : 'text-gray-300 bg-gray-100 hover:bg-gray-200'}`}>
                          {subOn ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PermissionControlPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [activeRole, setActiveRole] = useState<RoleKey>('REVIEWER');
  const [globalPerms, setGlobalPerms] = useState<Record<RoleKey, string[]>>({ REVIEWER: [], EVALUATOR: [], MODERATOR: [] });
  const [individualPerms, setIndividualPerms] = useState<IndividualPerm[]>([]);
  const [reviewers, setReviewers] = useState<Member[]>([]);
  const [evaluators, setEvaluators] = useState<Member[]>([]);
  const [moderators, setModerators] = useState<Member[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [individualAllowed, setIndividualAllowed] = useState<string[]>([]);
  const [hasIndividual, setHasIndividual] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/role-permissions', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/credentials/reviewers', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/credentials/evaluators', { headers: authHeaders() }).then(r => r.json()),
      fetch('/api/credentials/moderators', { headers: authHeaders() }).then(r => r.json()),
    ]).then(([permsData, rvwData, evlData, modData]) => {
      if (permsData.global) {
        const map: Record<RoleKey, string[]> = { REVIEWER: [], EVALUATOR: [], MODERATOR: [] };
        permsData.global.forEach((p: { role: string; allowedModules: string[] }) => {
          if (p.role === 'REVIEWER') map.REVIEWER = p.allowedModules;
          if (p.role === 'EVALUATOR') map.EVALUATOR = p.allowedModules;
          if (p.role === 'MODERATOR') map.MODERATOR = p.allowedModules;
        });
        setGlobalPerms(map);
        setIndividualPerms(Array.isArray(permsData.individual) ? permsData.individual : []);
      }
      if (Array.isArray(rvwData)) setReviewers(rvwData.map((r: any) => ({ id: r.id, name: r.name, reviewerId: r.reviewerId })));
      if (Array.isArray(evlData)) setEvaluators(evlData.map((e: any) => ({ id: e.id, name: e.name, evaluatorId: e.evaluatorId })));
      if (Array.isArray(modData)) setModerators(modData.map((m: any) => ({ id: m.id, name: m.name, moderatorId: m.moderatorId })));
    }).finally(() => setLoading(false));
  }, []);

  const members = activeRole === 'REVIEWER' ? reviewers : activeRole === 'EVALUATOR' ? evaluators : moderators;

  const selectMember = (m: Member) => {
    setSelectedMember(m);
    setSuccess(false); setError('');
    const existing = individualPerms.find(p => p.memberId === m.id);
    if (existing) { setIndividualAllowed(existing.allowedModules); setHasIndividual(true); }
    else { setIndividualAllowed(globalPerms[activeRole]); setHasIndividual(false); }
  };

  useEffect(() => {
    setSelectedMember(null);
    setIndividualAllowed([]);
    setHasIndividual(false);
    setSuccess(false); setError('');
  }, [activeRole, viewMode]);

  const enableAll = (allowed: string[], setAllowed: (v: string[]) => void) => {
    const all: string[] = [];
    MODULES.forEach(m => { all.push(m.key); m.subItems.forEach(s => all.push(s.key)); });
    setAllowed(all);
  };

  const disableAll = (setAllowed: (v: string[]) => void) => setAllowed([]);

  const handleSaveGlobal = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      const res = await fetch('/api/settings/role-permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ role: activeRole, allowedModules: globalPerms[activeRole] }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setSuccess(true); setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleSaveIndividual = async () => {
    if (!selectedMember) return;
    setSaving(true); setError(''); setSuccess(false);
    try {
      const res = await fetch('/api/settings/individual-permissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ role: activeRole, memberId: selectedMember.id, allowedModules: individualAllowed }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setHasIndividual(true);
      setIndividualPerms(prev => {
        const filtered = prev.filter(p => p.memberId !== selectedMember.id);
        return [...filtered, { memberId: selectedMember.id, allowedModules: individualAllowed }];
      });
      setSuccess(true); setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const handleRemoveIndividual = async () => {
    if (!selectedMember) return;
    setSaving(true); setError('');
    try {
      await fetch('/api/settings/individual-permissions', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ memberId: selectedMember.id }),
      });
      setHasIndividual(false);
      setIndividualAllowed(globalPerms[activeRole]);
      setIndividualPerms(prev => prev.filter(p => p.memberId !== selectedMember.id));
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  };

  const activeCount = MODULES.filter(m => (viewMode === 'global' ? globalPerms[activeRole] : individualAllowed).includes(m.key)).length;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Permission Control</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-[#004f9f]" />
          <span className="text-xs font-bold text-[#004f9f]">{activeCount}/{MODULES.length} Modules Active</span>
        </div>
      </div>

      {/* Global / Individual tabs */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-1.5 flex gap-1.5 w-fit">
        <button onClick={() => setViewMode('global')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'global' ? 'bg-[#004f9f] text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
          <Globe size={14} /> All (Global)
        </button>
        <button onClick={() => setViewMode('individual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'individual' ? 'bg-[#004f9f] text-white shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>
          <User size={14} /> Individual
        </button>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2">
        {ROLES.map(r => (
          <button key={r.key} onClick={() => setActiveRole(r.key)}
            className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${activeRole === r.key ? 'bg-[#004f9f] text-white border-[#004f9f]' : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Individual — member selector */}
      {viewMode === 'individual' && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Select {roleLabel(activeRole)}
          </p>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-gray-300" /></div>
          ) : members.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No {roleLabel(activeRole).toLowerCase()}s found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {members.map(m => {
                const hasOverride = individualPerms.some(p => p.memberId === m.id);
                const isSelected = selectedMember?.id === m.id;
                return (
                  <button key={m.id} onClick={() => selectMember(m)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${isSelected ? 'bg-[#004f9f] border-[#004f9f] text-white' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-[#004f9f]/10 text-[#004f9f]'}`}>
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}>{m.name}</p>
                      <p className={`text-[10px] font-mono ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                        {m.reviewerId || m.evaluatorId || m.moderatorId}
                      </p>
                    </div>
                    {hasOverride && (
                      <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isSelected ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'}`}>
                        Custom
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Individual — override notice */}
      {viewMode === 'individual' && selectedMember && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-medium ${hasIndividual ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
          <span>
            {hasIndividual
              ? `${selectedMember.name} has a custom override — changes here will update their individual settings.`
              : `Showing global defaults for ${activeRole}. Save to create an individual override for ${selectedMember.name}.`}
          </span>
          {hasIndividual && (
            <button onClick={handleRemoveIndividual} disabled={saving}
              className="flex items-center gap-1 ml-3 text-red-500 hover:text-red-700 font-bold shrink-0">
              <Trash2 size={11} /> Remove Override
            </button>
          )}
        </div>
      )}

      {/* Module list */}
      {(viewMode === 'global' || (viewMode === 'individual' && selectedMember)) && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
              <input type="text" placeholder="Search modules..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#004f9f]" />
            </div>
            <div className="flex items-center gap-2">
              {viewMode === 'global' ? (
                <>
                  <button onClick={() => enableAll(globalPerms[activeRole], v => setGlobalPerms(p => ({ ...p, [activeRole]: v })))}
                    className="px-3 py-1.5 text-xs font-bold text-[#004f9f] border border-[#004f9f]/20 bg-[#004f9f]/5 rounded-lg hover:bg-[#004f9f]/10 transition-colors">Enable All</button>
                  <button onClick={() => disableAll(v => setGlobalPerms(p => ({ ...p, [activeRole]: v })))}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Disable All</button>
                  <button onClick={handleSaveGlobal} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#004f9f] text-white text-xs font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => enableAll(individualAllowed, setIndividualAllowed)}
                    className="px-3 py-1.5 text-xs font-bold text-[#004f9f] border border-[#004f9f]/20 bg-[#004f9f]/5 rounded-lg hover:bg-[#004f9f]/10 transition-colors">Enable All</button>
                  <button onClick={() => disableAll(setIndividualAllowed)}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-200 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Disable All</button>
                  <button onClick={handleSaveIndividual} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-[#004f9f] text-white text-xs font-bold rounded-lg hover:bg-[#003d7a] disabled:opacity-50 transition-colors">
                    {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
                  </button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
          ) : viewMode === 'global' ? (
            <ModuleList
              allowed={globalPerms[activeRole]}
              setAllowed={v => setGlobalPerms(p => ({ ...p, [activeRole]: v }))}
              search={search}
            />
          ) : (
            <ModuleList allowed={individualAllowed} setAllowed={setIndividualAllowed} search={search} />
          )}

          {(error || success) && (
            <div className="px-5 py-3 border-t border-gray-100">
              {error && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3"><AlertCircle size={13} /> {error}</div>}
              {success && <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3"><CheckCircle2 size={13} /> Permissions saved successfully.</div>}
            </div>
          )}
        </div>
      )}

      {viewMode === 'individual' && !selectedMember && !loading && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm py-16 text-center text-gray-400 text-sm">
          Select a {roleLabel(activeRole).toLowerCase()} above to manage their permissions.
        </div>
      )}
    </div>
  );
}
