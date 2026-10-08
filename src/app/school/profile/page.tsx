'use client';

import { useEffect, useState } from 'react';
import {
  School as SchoolIcon, MapPin, AlertCircle, ShieldCheck, CheckCircle2, XCircle,
  CalendarDays, Pencil, Loader2, Lock,
} from 'lucide-react';
import { CARD, CARD_HEADER, CARD_TITLE, STACK, LABEL, INPUT, BTN_PRIMARY, BTN_SECONDARY, FOCUS } from '../ui';
import { PageHeader, StatusBadge, LoadingState, ErrorState } from '../components';

interface SchoolProfile {
  id: string;
  schoolId: string;
  olympiadId: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  contactPerson: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
  isActive: boolean;
  createdAt: string;
  examDate: string | null;
  attendanceSubmittedAt: string | null;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#EEF0F3] px-4 py-2 last:border-0">
      <dt className="flex-shrink-0 text-[12px] text-[#677285]">{label}</dt>
      <dd className="text-right text-[12.5px] font-medium text-[#0F1B2D]">
        {value || <span className="font-normal text-[#98A1B2]">Not provided</span>}
      </dd>
    </div>
  );
}

/**
 * Exam date — the one field a school can self-edit. SuperAdmin doesn't require
 * it at registration (schools register before a date is fixed), so a school
 * sets it here once known, and can correct it right up until attendance has
 * been submitted against it. After that it's frozen: it's what attendance was
 * actually marked against, not just a plan.
 */
function ExamDateCard({ profile, onSaved }: { profile: SchoolProfile; onSaved: (examDate: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile.examDate ? profile.examDate.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const locked = Boolean(profile.attendanceSubmittedAt);

  const startEdit = () => {
    setValue(profile.examDate ? profile.examDate.slice(0, 10) : '');
    setError('');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const token = sessionStorage.getItem('schoolToken');
      const res = await fetch('/api/school/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ examDate: value || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not save the exam date.');
      onSaved(data.examDate);
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={CARD}>
      <div className={`${CARD_HEADER} justify-between`}>
        <div className="flex items-center gap-2">
          <CalendarDays size={14} strokeWidth={1.75} className="text-[#677285]" />
          <h2 className={CARD_TITLE}>Exam date</h2>
        </div>
        {!editing && !locked && (
          <button
            onClick={startEdit}
            className={`inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-[#1559C7] hover:text-[#0F4AAE] ${FOCUS} rounded`}
          >
            <Pencil size={12} /> {profile.examDate ? 'Edit' : 'Set date'}
          </button>
        )}
      </div>

      <div className="px-4 py-3.5">
        {editing ? (
          <div>
            <label htmlFor="examDate" className={LABEL}>Exam date</label>
            <input
              id="examDate"
              type="date"
              value={value}
              onChange={e => setValue(e.target.value)}
              className={`${INPUT} max-w-[220px]`}
            />
            {error && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#B42323]">
                <AlertCircle size={13} className="flex-shrink-0" /> {error}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button onClick={save} disabled={saving} className={`${BTN_PRIMARY} h-8 px-3 text-[12.5px]`}>
                {saving && <Loader2 size={13} className="animate-spin" />} Save
              </button>
              <button onClick={() => setEditing(false)} disabled={saving} className={`${BTN_SECONDARY} h-8 px-3 text-[12.5px]`}>
                Cancel
              </button>
            </div>
          </div>
        ) : profile.examDate ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[18px] font-semibold tabular-nums text-[#0F1B2D]">
              {new Date(profile.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
            {locked && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#677285]">
                <Lock size={12} /> Locked
              </span>
            )}
          </div>
        ) : (
          <p className="text-[12.5px] text-[#98A1B2]">Not set yet — add it once your exam date is finalised.</p>
        )}
        {locked && !editing && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-[#677285]">
            Attendance has been submitted for this date, so it&apos;s locked. Contact your Mittsure coordinator to change it.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SchoolProfilePage() {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = sessionStorage.getItem('schoolToken');
    if (!token) { setError('Not authenticated'); setLoading(false); return; }

    fetch('/api/school/me/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load');
        setProfile(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading profile…" />;
  if (error || !profile) return <ErrorState message={error || 'Profile unavailable'} />;

  return (
    <div className={STACK}>

      <PageHeader
        icon={SchoolIcon}
        title={profile.name}
        actions={
          profile.isActive
            ? <StatusBadge tone="success" icon={CheckCircle2}>Active</StatusBadge>
            : <StatusBadge tone="danger" icon={XCircle}>Inactive</StatusBadge>
        }
      />

      {/* Identity chips — the two IDs a coordinator asks for most often, kept
          at the top so they are never a scroll away. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { label: 'School ID (login)', value: profile.schoolId },
          { label: 'CRM / Olympiad ID', value: profile.olympiadId },
        ].map(x => (
          <div key={x.label} className={`${CARD} px-3.5 py-2.5`}>
            <p className="text-[11.5px] font-medium text-[#677285]">{x.label}</p>
            <p className="mt-1 select-all font-mono text-[16px] font-semibold tabular-nums text-[#0F1B2D]">{x.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Identity */}
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <ShieldCheck size={14} strokeWidth={1.75} className="text-[#677285]" />
            <h2 className={CARD_TITLE}>School identity</h2>
          </div>
          <dl>
            <InfoRow label="School name" value={profile.name} />
            <InfoRow label="Contact person" value={profile.contactPerson} />
            <InfoRow label="School ID (login)" value={profile.schoolId} />
            <InfoRow label="CRM / Olympiad ID" value={profile.olympiadId} />
            <InfoRow
              label="Registered on"
              value={new Date(profile.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            />
          </dl>
        </div>

        {/* Contact & Location */}
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <MapPin size={14} strokeWidth={1.75} className="text-[#677285]" />
            <h2 className={CARD_TITLE}>Contact &amp; location</h2>
          </div>
          <dl>
            <InfoRow label="Phone" value={profile.phone} />
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Address" value={profile.address} />
            <InfoRow label="City" value={profile.city} />
            <InfoRow label="District" value={profile.district} />
            <InfoRow label="State" value={profile.state} />
            <InfoRow label="Pincode" value={profile.pincode} />
          </dl>
        </div>
      </div>

      {/* Exam date — the one self-editable field */}
      <ExamDateCard profile={profile} onSaved={examDate => setProfile(p => (p ? { ...p, examDate } : p))} />

      {/* Notice */}
      <div className={`${CARD} flex items-start gap-2.5 px-4 py-3`}>
        <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#A1530A]" />
        <p className="text-[12.5px] leading-relaxed text-[#475265]">
          To update your exam date, use the card above. For any other school details, please contact your Mittsure coordinator —
          schools cannot self-edit other profile information.
        </p>
      </div>
    </div>
  );
}
