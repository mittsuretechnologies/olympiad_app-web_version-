'use client';

import { useEffect, useState } from 'react';
import { School as SchoolIcon, MapPin, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

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
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-600 font-medium">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">
        {value || <span className="text-gray-400 font-normal">— Not provided —</span>}
      </span>
    </div>
  );
}

export default function SchoolProfilePage() {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('schoolToken');
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

  if (loading) {
    return (
      <div className="bg-white border border-gray-300 py-20 flex flex-col items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#06013E]" />
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white border border-red-300 py-16 text-center text-red-700 text-sm">
        {error || 'Profile unavailable'}
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Title bar */}
      <div className="bg-white border border-gray-300">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-300 bg-[#F4F5F7]">
          <div className="flex items-center gap-2">
            <SchoolIcon size={15} className="text-[#06013E]" />
            <h1 className="text-[13px] font-bold text-[#06013E] uppercase tracking-wide">School Profile Record</h1>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border ${
            profile.isActive ? 'text-green-700 border-green-300 bg-green-50' : 'text-red-700 border-red-300 bg-red-50'
          }`}>
            {profile.isActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>

        {/* Identity strip */}
        <div className="flex flex-wrap divide-x divide-gray-200">
          <div className="px-4 py-2.5 flex items-center justify-between min-w-[200px]">
            <span className="text-[11px] text-gray-600 font-medium">School Name</span>
            <span className="text-sm font-bold text-[#06013E]">{profile.name}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center justify-between min-w-[160px]">
            <span className="text-[11px] text-gray-600 font-medium">School ID</span>
            <span className="text-sm font-bold text-[#06013E] font-mono">{profile.schoolId}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

        {/* Identity */}
        <div className="bg-white border border-gray-300">
          <div className="px-4 py-2.5 border-b border-gray-300 bg-[#F4F5F7] flex items-center gap-2">
            <ShieldCheck size={13} className="text-[#06013E]" />
            <h2 className="text-[12px] font-bold uppercase tracking-wide text-[#06013E]">School Identity</h2>
          </div>
          <div>
            <InfoRow label="School ID (Login)" value={profile.schoolId} />
            <InfoRow label="CRM / Olympiad ID" value={profile.olympiadId} />
            <InfoRow label="School Name" value={profile.name} />
            <InfoRow label="Contact Person" value={profile.contactPerson} />
            <InfoRow label="Registered On" value={
              new Date(profile.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
            } />
          </div>
        </div>

        {/* Contact & Location */}
        <div className="bg-white border border-gray-300">
          <div className="px-4 py-2.5 border-b border-gray-300 bg-[#F4F5F7] flex items-center gap-2">
            <MapPin size={13} className="text-[#06013E]" />
            <h2 className="text-[12px] font-bold uppercase tracking-wide text-[#06013E]">Contact &amp; Location</h2>
          </div>
          <div>
            <InfoRow label="Phone" value={profile.phone} />
            <InfoRow label="Email" value={profile.email} />
            <InfoRow label="Address" value={profile.address} />
            <InfoRow label="City" value={profile.city} />
            <InfoRow label="District" value={profile.district} />
            <InfoRow label="State" value={profile.state} />
            <InfoRow label="Pincode" value={profile.pincode} />
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="bg-white border border-gray-300 px-4 py-3 flex items-start gap-2.5">
        <AlertCircle size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 leading-relaxed">
          To update any school details, please contact your Mittsure coordinator. Schools cannot self-edit profile information.
        </p>
      </div>
    </div>
  );
}
