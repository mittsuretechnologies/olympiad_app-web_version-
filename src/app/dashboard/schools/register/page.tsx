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
    state: '',
    pincode: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [credentials, setCredentials] = useState<{
    schoolId: string;
    username: string;
    password: string;
  } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

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
          state: formData.state,
          pincode: formData.pincode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Failed to register school' });
        setCredentials(null);
      } else {
        setMessage({
          type: 'success',
          text: `School registered successfully! Assigned School ID: ${data.schoolId}`,
        });
        if (data.credentials) {
          setCredentials({
            schoolId: data.schoolId,
            username: data.credentials.username,
            password: data.credentials.password,
          });
        }
        setFormData({
          schoolName: '', olympiadId: '', principalName: '', email: '', phone: '',
          address: '', city: '', state: '', pincode: '',
        });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const labelCls = "block text-xs font-bold text-[#06013E] mb-1.5 uppercase tracking-wide";
  const inputCls = "w-full h-10 border border-gray-300 rounded-none px-3 text-sm text-[#432818] placeholder:text-gray-400 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] transition-all bg-white";

  return (
    <div className="bg-white border border-gray-300 shadow-sm max-w-4xl mx-auto">
      {/* Title Bar */}
      <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
        <h1 className="text-base font-bold uppercase tracking-wider">
          Register New School
        </h1>
      </div>

      <div className="p-6 bg-white">
        {message && (
          <div
            className={`mb-5 px-4 py-3 text-sm font-medium border ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-300'
                : 'bg-red-50 text-red-800 border-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {credentials && (
          <div className="mb-6 bg-yellow-50 border border-yellow-300 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[#06013E] uppercase tracking-wider">
                School Login Credentials (save now — password will not be shown again)
              </h3>
              <button
                type="button"
                onClick={() => {
                  const text = `School ID: ${credentials.schoolId}\nUsername: ${credentials.username}\nPassword: ${credentials.password}\nLogin URL: ${window.location.origin}/school-login`;
                  navigator.clipboard.writeText(text);
                }}
                className="text-xs font-semibold text-[#06013E] underline hover:text-[#0a0660]"
              >
                Copy all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Username</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.username}</div>
              </div>
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Password</div>
                <div className="font-mono font-bold text-[#06013E]">{credentials.password}</div>
              </div>
              <div className="bg-white border border-gray-200 p-2">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Login URL</div>
                <a
                  href="/school-login"
                  target="_blank"
                  className="font-mono text-xs text-[#06013E] underline break-all"
                >
                  /school-login
                </a>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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
                placeholder="e.g. OLYMP-2026-001"
              />
            </div>

            <div>
              <label className={labelCls}>
                Principal / Contact Person <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="principalName"
                value={formData.principalName}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="Enter principal name"
              />
            </div>
            <div>
              <label className={labelCls}>
                Phone Number <span className="text-red-600">*</span>
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="10 digit mobile"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>
                Email Address <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="school@example.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelCls}>
                Full Postal Address <span className="text-red-600">*</span>
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                rows={3}
                className="w-full border border-gray-300 rounded-none p-3 text-sm text-[#432818] placeholder:text-gray-400 focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] transition-all bg-white resize-none"
                placeholder="Street, area, landmark..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <label className={labelCls}>
                City <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="City"
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
                Pincode <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="XXXXXX"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setFormData({
                schoolName: '', olympiadId: '', principalName: '', email: '', phone: '',
                address: '', city: '', state: '', pincode: '',
              })}
              disabled={loading}
              className="h-10 px-5 bg-white border border-gray-400 text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-6 bg-[#06013E] text-white font-semibold text-sm hover:bg-[#0a0660] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Registering...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
