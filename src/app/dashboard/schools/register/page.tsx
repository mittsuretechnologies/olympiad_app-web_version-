'use client';

import { useState } from 'react';

export default function RegisterSchoolPage() {
  const [formData, setFormData] = useState({
    schoolName: '',
    olympiadId: '',
    principalName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    studentCount: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [credentials, setCredentials] = useState<{
    schoolId: string;
    username: string;
    password: string;
    idsGenerated: number;
    idPreview: string;
  } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Live preview of ID format
  const previewId = (() => {
    const crm = (formData.olympiadId || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    const nm = (formData.schoolName || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    const count = parseInt(formData.studentCount || '0', 10);
    const pad = count > 999 ? 4 : count > 99 ? 3 : 2;
    const remaining = 12 - crm.length - nm.length;
    const num = String(1).padStart(Math.min(pad, remaining), '0');
    return crm + nm + num;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setCredentials(null);

    const count = parseInt(formData.studentCount || '0', 10);
    if (!count || count < 1 || count > 2000) {
      setMessage({ type: 'error', text: 'Student count must be between 1 and 2000.' });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.schoolName,
          olympiadId: formData.olympiadId,
          contactPerson: formData.principalName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          district: formData.district,
          state: formData.state,
          pincode: formData.pincode,
          studentCount: count,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to register school' });
      } else {
        setMessage({
          type: 'success',
          text: `School registered (${data.schoolId}) — ${data.olympiadIdsGenerated} Olympiad IDs generated.`,
        });
        if (data.credentials) {
          setCredentials({
            schoolId: data.schoolId,
            username: data.credentials.username,
            password: data.credentials.password,
            idsGenerated: data.olympiadIdsGenerated,
            idPreview: data.olympiadIdPrefix,
          });
        }
        setFormData({
          schoolName: '', olympiadId: '', principalName: '', email: '', phone: '',
          address: '', city: '', district: '', state: '', pincode: '', studentCount: '',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const labelCls = "block text-xs font-bold text-[#06013E] mb-1.5 uppercase tracking-wide";
  const inputCls = "w-full h-10 border border-gray-300 rounded-none px-3 text-sm text-[#432818] placeholder:text-gray-400 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] bg-white";

  return (
    <div className="bg-white border border-gray-300 shadow-sm max-w-4xl mx-auto">
      <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
        <h1 className="text-base font-bold uppercase tracking-wider">Register New School</h1>
      </div>

      <div className="p-6 bg-white">
        {message && (
          <div className={`mb-5 px-4 py-3 text-sm font-medium border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}>
            {message.text}
          </div>
        )}

        {credentials && (
          <div className="mb-6 bg-yellow-50 border border-yellow-300 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#06013E] uppercase tracking-wider">
                School Login Credentials — save now, password not shown again
              </h3>
              <button
                type="button"
                onClick={() => {
                  const text = `School ID: ${credentials.schoolId}\nUsername: ${credentials.username}\nPassword: ${credentials.password}\nLogin URL: ${window.location.origin}/login`;
                  navigator.clipboard.writeText(text);
                }}
                className="text-xs font-semibold text-[#06013E] underline"
              >
                Copy all
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase">School ID</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.schoolId}</div>
              </div>
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Username</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.username}</div>
              </div>
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase">Password</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.password}</div>
              </div>
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase">IDs Generated</div>
                <div className="font-bold text-green-700">{credentials.idsGenerated} IDs</div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 p-2 text-xs">
              <span className="text-gray-500 font-bold uppercase">ID Range: </span>
              <span className="font-mono text-[#06013E]">
                {credentials.idPreview}01 ... {credentials.idPreview}{String(credentials.idsGenerated).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Row 1: Name + CRM ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelCls}>
                Official School Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="Enter school name"
              />
            </div>
            <div>
              <label className={labelCls}>
                CRM ID <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="olympiadId"
                value={formData.olympiadId}
                onChange={handleChange}
                required
                className={`${inputCls} font-mono`}
                placeholder="e.g. OLY2026001"
              />
            </div>
          </div>

          {/* Row 2: Student Count + ID Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelCls}>
                Student Count <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                name="studentCount"
                value={formData.studentCount}
                onChange={handleChange}
                required
                min={1}
                max={2000}
                className={inputCls}
                placeholder="Number of students (max 2000)"
              />
            </div>
            <div>
              <label className={labelCls}>Olympiad ID Preview</label>
              <div className="h-10 border border-gray-200 bg-gray-50 px-3 flex items-center gap-3">
                <span className="font-mono text-sm text-[#06013E] font-bold">
                  {previewId.length === 12 ? previewId : previewId || '---'}
                </span>
                {previewId.length < 12 && formData.olympiadId && (
                  <span className="text-xs text-gray-400">
                    ({previewId.length}/12 chars — fill CRM ID + Name)
                  </span>
                )}
                {previewId.length === 12 && (
                  <span className="text-xs text-green-600 font-semibold">✓ 12 chars</span>
                )}
              </div>
            </div>
          </div>

          {/* Contact & Location Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <label className={labelCls}>Principal / Contact Person</label>
              <input
                type="text"
                name="principalName"
                value={formData.principalName}
                onChange={handleChange}
                className={inputCls}
                placeholder="Enter principal name (optional)"
              />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={inputCls}
                placeholder="10 digit mobile (optional)"
              />
            </div>
            <div>
              <label className={labelCls}>Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={inputCls}
                placeholder="school@example.com (optional)"
              />
            </div>
            <div>
              <label className={labelCls}>
                State <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="State"
              />
            </div>
            <div>
              <label className={labelCls}>
                District <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="District"
              />
            </div>
            <div>
              <label className={labelCls}>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className={inputCls}
                placeholder="City"
              />
            </div>
            <div>
              <label className={labelCls}>Pincode</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                className={inputCls}
                placeholder="XXXXXX"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Full Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={inputCls}
                placeholder="School building, street, area (optional)"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setFormData({
                schoolName: '', olympiadId: '', principalName: '', email: '', phone: '',
                address: '', city: '', district: '', state: '', pincode: '', studentCount: '',
              })}
              disabled={loading}
              className="h-10 px-5 bg-white border border-gray-400 text-gray-700 font-semibold text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-6 bg-[#06013E] text-white font-semibold text-sm hover:bg-[#0a0660] disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register School & Generate IDs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
