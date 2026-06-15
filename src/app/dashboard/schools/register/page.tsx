'use client';

import { useState } from 'react';
import { CLASSES } from '@/lib/classes';

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
  });

  // Per-class student counts, keyed by class name (e.g. "Class 5": "30").
  // A class is "selected" once it has an entry in this map.
  const [classCounts, setClassCounts] = useState<Record<string, string>>({});

  const toggleClass = (name: string) => {
    setClassCounts((prev) => {
      const next = { ...prev };
      if (name in next) {
        delete next[name];
      } else {
        next[name] = '';
      }
      return next;
    });
  };

  const setClassCount = (name: string, value: string) => {
    setClassCounts((prev) => ({ ...prev, [name]: value.replace(/[^0-9]/g, '') }));
  };

  const selectedClasses = CLASSES.filter((c) => c.name in classCounts);
  const totalStudents = selectedClasses.reduce(
    (sum, c) => sum + (parseInt(classCounts[c.name] || '0', 10) || 0),
    0
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (selectedClasses.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one class and enter its student count.' });
      setLoading(false);
      return;
    }

    const classesPayload = selectedClasses.map((c) => ({
      className: c.name,
      count: parseInt(classCounts[c.name] || '0', 10),
    }));

    const emptyClass = classesPayload.find((c) => !c.count || c.count < 1);
    if (emptyClass) {
      setMessage({ type: 'error', text: `Enter a valid student count for ${emptyClass.className}.` });
      setLoading(false);
      return;
    }

    if (totalStudents < 1 || totalStudents > 2000) {
      setMessage({ type: 'error', text: 'Total students (sum of all classes) must be between 1 and 2000.' });
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
          classes: classesPayload,
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
        setFormData({
          schoolName: '', olympiadId: '', principalName: '', email: '', phone: '',
          address: '', city: '', district: '', state: '', pincode: '',
        });
        setClassCounts({});
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const labelCls = "block text-xs font-bold text-black mb-1 uppercase tracking-wide";
  const inputCls = "w-full h-9 border border-gray-300 rounded-none px-3 text-sm text-[#432818] placeholder:text-gray-400 focus:outline-none focus:border-[#009846] focus:ring-1 focus:ring-[#009846] bg-white";

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-[#06013E]">Register New School</h1>
      <div className="max-w-4xl bg-[#FFFEFE] border border-gray-300 shadow-sm">
      <div className="p-5">
        {message && (
          <div className={`mb-5 px-4 py-3 text-sm font-medium border ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border-green-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}>
            {message.text}
          </div>
        )}


        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Row 1: Name + CRM ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
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

          {/* Row 2: Class selection + per-class counts */}
          <div>
            <label className={labelCls}>
              Select Classes <span className="text-red-600">*</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {CLASSES.map((c) => {
                const active = c.name in classCounts;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggleClass(c.name)}
                    className={`px-3 h-9 text-sm font-semibold border transition-colors ${
                      active
                        ? 'bg-[#009846] text-white border-[#009846]'
                        : 'bg-white text-black border-gray-300 hover:border-[#FFC107]'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>

            {selectedClasses.length > 0 && (
              <div className="border border-gray-300">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-300 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#009846] uppercase tracking-wide">
                    Students per Class
                  </span>
                  <span className="text-xs font-bold text-green-700">
                    Total: {totalStudents}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 p-3">
                  {selectedClasses.map((c) => (
                    <div key={c.name} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 flex items-center gap-1.5 text-sm font-semibold text-[#432818]">
                        {c.name}
                        <span className="font-mono text-[11px] text-gray-400">[{c.code}]</span>
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={classCounts[c.name]}
                        onChange={(e) => setClassCount(c.name, e.target.value)}
                        className="flex-1 min-w-0 h-9 border border-gray-300 px-2 text-sm text-[#432818] focus:outline-none focus:border-[#009846] focus:ring-1 focus:ring-[#009846]"
                        placeholder="Count"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Contact & Location Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
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
              onClick={() => {
                setFormData({
                  schoolName: '', olympiadId: '', principalName: '', email: '', phone: '',
                  address: '', city: '', district: '', state: '', pincode: '',
                });
                setClassCounts({});
              }}
              disabled={loading}
              className="h-10 px-5 bg-white border border-gray-400 text-gray-700 font-semibold text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-10 px-6 bg-[#009846] text-white font-semibold text-sm hover:bg-[#007a38] disabled:opacity-50"
            >
              {loading ? 'Registering...' : 'Register School & Generate IDs'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
