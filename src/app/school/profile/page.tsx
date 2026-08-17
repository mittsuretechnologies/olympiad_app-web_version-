'use client';

import { useEffect, useState } from 'react';
import { School as SchoolIcon, MapPin, AlertCircle, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { CARD, CARD_HEADER, CARD_TITLE, STACK } from '../ui';
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
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F1F3F6] px-4 py-2 last:border-0">
      <dt className="flex-shrink-0 text-[12px] text-[#6B7280]">{label}</dt>
      <dd className="text-right text-[12.5px] font-medium text-[#111827]">
        {value || <span className="font-normal text-[#9CA3AF]">Not provided</span>}
      </dd>
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
        subtitle="School profile"
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
            <p className="text-[11.5px] font-medium text-[#6B7280]">{x.label}</p>
            <p className="mt-1 select-all font-mono text-[16px] font-semibold text-[#111827]">{x.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">

        {/* Identity */}
        <div className={CARD}>
          <div className={CARD_HEADER}>
            <ShieldCheck size={14} className="text-[#6B7280]" />
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
            <MapPin size={14} className="text-[#6B7280]" />
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

      {/* Notice */}
      <div className={`${CARD} flex items-start gap-2.5 px-4 py-3`}>
        <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-[#B45309]" />
        <p className="text-[12.5px] leading-relaxed text-[#4B5563]">
          To update any school details, please contact your Mittsure coordinator.
          Schools cannot self-edit profile information.
        </p>
      </div>
    </div>
  );
}
