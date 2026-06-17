'use client';

import { useEffect, useState } from 'react';
import {
  School as SchoolIcon, MapPin, Phone, Mail, User,
  Hash, Building2, Loader2, CheckCircle2, AlertCircle,
  Calendar, ShieldCheck
} from 'lucide-react';

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

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-[#E8EAF6] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-black" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-black break-words">
          {value || <span className="text-gray-300 font-normal italic">Not provided</span>}
        </p>
      </div>
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
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-black" />
        <p className="text-sm text-gray-400">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-white border border-red-200 p-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-red-600 text-sm">{error || 'Profile unavailable'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div className="bg-[#E8EAF6] text-[#06013E] px-6 py-4 border-b-4 border-[#FF9000] flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-[#06013E]/10 border border-[#06013E]/20 flex items-center justify-center flex-shrink-0">
          <SchoolIcon size={28} className="text-[#FF9000]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#06013E]/40 mb-0.5">School Profile</p>
          <h1 className="text-lg font-black truncate">{profile.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-[#06013E]/50 font-mono">{profile.schoolId}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${
              profile.isActive ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'
            }`}>
              {profile.isActive ? <><CheckCircle2 size={9} /> Active</> : <><AlertCircle size={9} /> Inactive</>}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Identity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <ShieldCheck size={13} className="text-black" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">School Identity</h2>
          </div>
          <div className="px-5">
            <InfoRow icon={Hash} label="School ID (Login)" value={profile.schoolId} />
            <InfoRow icon={Building2} label="CRM / Olympiad ID" value={profile.olympiadId} />
            <InfoRow icon={SchoolIcon} label="School Name" value={profile.name} />
            <InfoRow icon={User} label="Contact Person" value={profile.contactPerson} />
            <InfoRow icon={Calendar} label="Registered On" value={
              new Date(profile.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
            } />
          </div>
        </div>

        {/* Contact & Location */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <MapPin size={13} className="text-black" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-black">Contact & Location</h2>
          </div>
          <div className="px-5">
            <InfoRow icon={Phone} label="Phone" value={profile.phone} />
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={MapPin} label="Address" value={profile.address} />
            <InfoRow icon={Building2} label="City" value={profile.city} />
            <InfoRow icon={Building2} label="District" value={profile.district} />
            <InfoRow icon={Building2} label="State" value={profile.state} />
            <InfoRow icon={Hash} label="Pincode" value={profile.pincode} />
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="bg-[#E8EAF6] border border-[#06013E]/10 px-5 py-4 flex items-start gap-3">
        <AlertCircle size={14} className="text-black/50 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-black/60 leading-relaxed">
          To update any school details, please contact your Mittsure coordinator. Schools cannot self-edit profile information.
        </p>
      </div>
    </div>
  );
}

