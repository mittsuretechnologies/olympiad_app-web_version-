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
      <span className="text-[11px] text-gray-500 font-medium">{label}</span>
      <span className="text-sm font-semibold text-black text-right">
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

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] py-20 flex flex-col items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#1559C7]" />
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-red-200 py-16 text-center text-red-600 text-sm">
        {error || 'Profile unavailable'}
      </div>
    );
  }

  const dotTexture: React.CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(11,11,11,0.035) 0px, rgba(11,11,11,0.035) 1px, transparent 1px, transparent 10px)',
  };

  return (
    <div className="space-y-4">

      {/* Header banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#eb6834] to-[#d95926] p-6 text-white shadow-[0_8px_24px_rgba(217,89,38,0.25)]">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 right-24 w-28 h-28 rounded-full bg-white/10" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <SchoolIcon size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">School Profile</p>
              <h1 className="text-xl font-black tracking-tight">{profile.name}</h1>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full ${
            profile.isActive ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${profile.isActive ? 'bg-emerald-300' : 'bg-red-300'}`} />
            {profile.isActive ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
        <div className="relative flex flex-wrap gap-2 mt-4">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="text-[11px] font-bold">School ID: {profile.schoolId}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5">
            <span className="text-[11px] font-bold">CRM / Olympiad ID: {profile.olympiadId}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Identity */}
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] overflow-hidden" style={dotTexture}>
          <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-[#1559C7]/5 to-transparent flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#1559C7]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">School Identity</h2>
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
        <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] overflow-hidden" style={dotTexture}>
          <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-emerald-500/5 to-transparent flex items-center gap-2">
            <MapPin size={14} className="text-[#0d9f6e]" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">Contact &amp; Location</h2>
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
      <div className="bg-white rounded-2xl shadow-[0_2px_14px_rgba(0,0,0,0.06)] border border-[#E7EBF2] px-5 py-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#d98600]/10 flex items-center justify-center flex-shrink-0">
          <AlertCircle size={15} className="text-[#d98600]" />
        </div>
        <p className="text-xs text-gray-600 leading-relaxed pt-1.5">
          To update any school details, please contact your Mittsure coordinator. Schools cannot self-edit profile information.
        </p>
      </div>
    </div>
  );
}
