'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Upload,
  Search,
  School as SchoolIcon,
  FileSpreadsheet,
  Download,
  Edit,
  Trash,
  Loader2,
  Eye,
  Hash,
  Send,
  CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface School {
  id: string;
  schoolId?: string;
  olympiadId: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
}

export default function SchoolsPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // View / Allocation state
  const [viewSchool, setViewSchool] = useState<School | null>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [allocLoading, setAllocLoading] = useState(false);
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [allocPrefix, setAllocPrefix] = useState('');
  const [allocCount, setAllocCount] = useState(50);
  const [allocPadding, setAllocPadding] = useState(4);
  const [allocBusy, setAllocBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [allocError, setAllocError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    olympiadId: '',
    address: '',
    email: '',
    phone: '',
    contactPerson: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    olympiadId: '',
    address: '',
    email: '',
    phone: '',
    contactPerson: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      const res = await fetch('/api/schools');
      const data = await res.json();
      setSchools(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsAddModalOpen(false);
        setFormData({ name: '', olympiadId: '', address: '', email: '', phone: '', contactPerson: '' });
        fetchSchools();
      }
    } catch (error) {
      console.error('Add error:', error);
    }
  };

  const openEditModal = (school: any) => {
    setEditingSchool(school);
    setEditFormData({
      name: school.name || '',
      olympiadId: school.olympiadId || '',
      address: school.address || '',
      email: school.email || '',
      phone: school.phone || '',
      contactPerson: school.contactPerson || '',
      city: school.city || '',
      district: school.district || '',
      state: school.state || '',
      pincode: school.pincode || '',
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/schools/${editingSchool.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      if (res.ok) {
        setIsEditModalOpen(false);
        setEditingSchool(null);
        fetchSchools();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to update school');
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Network error while updating school');
    } finally {
      setActionBusy(false);
    }
  };

  const openViewModal = async (school: School) => {
    setViewSchool(school);
    setShowAllocateForm(false);
    setAllocError(null);
    setAllocCount(50);
    setAllocLoading(true);

    const crm = (school.olympiadId || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    const nm = (school.name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
    const defaultPrefix = (crm + nm).slice(0, 10);
    
    // Initial guess
    setAllocPrefix(defaultPrefix);
    setAllocPadding(2);

    try {
      const res = await fetch(`/api/schools/${school.id}/olympiad-ids`);
      const data = await res.json();
      const loadedAllocations = Array.isArray(data) ? data : [];
      setAllocations(loadedAllocations);

      if (loadedAllocations.length > 0) {
        const lastAlloc = loadedAllocations[loadedAllocations.length - 1];
        if (lastAlloc.prefix) {
          setAllocPrefix(lastAlloc.prefix);
          const pad = lastAlloc.code.length - lastAlloc.prefix.length;
          setAllocPadding(pad > 0 ? pad : 2);
        }
      }
    } catch (err) {
      console.error('Fetch allocations failed:', err);
      setAllocations([]);
    } finally {
      setAllocLoading(false);
    }
  };

  const refreshAllocations = async (schoolId: string) => {
    setAllocLoading(true);
    try {
      const res = await fetch(`/api/schools/${schoolId}/olympiad-ids`);
      const data = await res.json();
      const loaded = Array.isArray(data) ? data : [];
      setAllocations(loaded);

      if (loaded.length > 0) {
        const lastAlloc = loaded[loaded.length - 1];
        if (lastAlloc.prefix) {
          setAllocPrefix(lastAlloc.prefix);
          const pad = lastAlloc.code.length - lastAlloc.prefix.length;
          setAllocPadding(pad > 0 ? pad : 2);
        }
      }
    } finally {
      setAllocLoading(false);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewSchool) return;
    setAllocError(null);

    if (!allocPrefix.trim()) {
      setAllocError('Prefix is required');
      return;
    }
    if (!allocCount || allocCount < 1 || allocCount > 1000) {
      setAllocError('Count must be between 1 and 1000');
      return;
    }

    setAllocBusy(true);
    try {
      const res = await fetch(`/api/schools/${viewSchool.id}/olympiad-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: allocPrefix.trim(),
          count: allocCount,
          padding: allocPadding,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAllocError(data.message || 'Failed to allocate IDs');
      } else {
        setShowAllocateForm(false);
        refreshAllocations(viewSchool.id);
      }
    } catch (err) {
      setAllocError('Network error while allocating IDs');
    } finally {
      setAllocBusy(false);
    }
  };

  const handleSendIds = async () => {
    if (!viewSchool) return;
    const pending = allocations.filter((a) => !a.sentAt).length;
    if (pending === 0) {
      setSendResult('All IDs already sent.');
      setTimeout(() => setSendResult(null), 3000);
      return;
    }
    if (!confirm(`Send ${pending} pending Olympiad ID(s) to ${viewSchool.name}?`)) return;

    setSendBusy(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/schools/${viewSchool.id}/olympiad-ids/send`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setSendResult(data.message || 'Failed to send IDs');
      } else {
        setSendResult(`${data.sent} ID(s) sent to school successfully.`);
        refreshAllocations(viewSchool.id);
      }
    } catch {
      setSendResult('Network error while sending IDs');
    } finally {
      setSendBusy(false);
      setTimeout(() => setSendResult(null), 4000);
    }
  };

  const exportAllocationsCSV = () => {
    if (!viewSchool || allocations.length === 0) return;
    const rows = [
      ['Olympiad ID', 'Delivery', 'Allocated On'],
      ...allocations.map((a) => [
        a.code,
        a.sentAt ? 'Delivered' : 'Pending',
        new Date(a.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `olympiad-ids-${viewSchool.schoolId || viewSchool.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteSchool = async () => {
    if (!deleteTarget) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/schools/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeleteTarget(null);
        fetchSchools();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to delete school');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Network error while deleting school');
    } finally {
      setActionBusy(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const formattedData = data.map((item: any) => ({
        name: item['School Name'] || item['name'],
        olympiadId: String(item['CRM ID'] || item['olympiadId']),
        address: item['Address'] || item['address'],
        email: item['Email'] || item['email'],
        phone: item['Phone'] || item['phone'],
        contactPerson: item['Contact Person'] || item['contactPerson'],
        city: item['City'] || item['city'],
        district: item['District'] || item['district'],
        state: item['State'] || item['state'],
        pincode: item['Pincode'] || item['pincode'],
      }));

      try {
        const res = await fetch('/api/schools/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schools: formattedData }),
        });
        if (res.ok) {
          setIsBulkModalOpen(false);
          fetchSchools();
        }
      } catch (error) {
        console.error('Bulk upload error:', error);
      }
    };
    reader.readAsBinaryString(file);
  };

  const lastAllocationWithPrefix = allocations
    .filter((a) => a.prefix === allocPrefix)
    .reduce((max, a) => (a.sequence > max ? a.sequence : max), 0);
  const startSeq = lastAllocationWithPrefix + 1;

  const filteredSchools = Array.isArray(schools)
    ? schools.filter(
        (s) =>
          s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.olympiadId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.schoolId?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="bg-white border border-gray-300 shadow-sm">
      {/* Title Bar */}
      <div className="bg-[#06013E] text-white px-6 py-3 flex items-center justify-between border-b-4 border-[#FF9000]">
        <div className="flex items-center gap-3">
          <SchoolIcon size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider">School Directory</h1>
        </div>
        <div className="text-xs text-gray-300">
          Manage partner institutions and registration IDs
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Total Registered Schools:</span>
          <span className="font-bold text-[#06013E]">{schools.length}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white border border-gray-400 text-[#06013E] px-4 py-2 text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            <Upload className="w-4 h-4" /> Bulk Register
          </button>
          <button
            onClick={() => router.push('/dashboard/schools/register')}
            className="inline-flex items-center gap-2 bg-[#06013E] text-white px-4 py-2 text-sm font-semibold hover:bg-[#0a0660] transition-colors"
          >
            <Plus className="w-4 h-4" /> Register School
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-6 py-3 border-b border-gray-300 bg-white">
        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search by school name, School ID or CRM ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#06013E]">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300 w-12">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                School ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                CRM ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                School Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                Contact Person
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                Phone
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-36">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#06013E] mb-2" />
                  <p className="text-gray-600 text-sm">Loading records...</p>
                </td>
              </tr>
            ) : filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <p className="text-gray-500 text-sm">No records found.</p>
                </td>
              </tr>
            ) : (
              filteredSchools.map((school, idx) => (
                <tr
                  key={school.id}
                  className={`border-b border-gray-200 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } hover:bg-yellow-50 transition-colors`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono font-semibold text-[#06013E]">
                    {school.schoolId || '-'}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-gray-700">
                    {school.olympiadId}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">
                    {school.name}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">
                    {[school.city, school.state].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">
                    {school.contactPerson || '-'}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">
                    {school.email || '-'}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">
                    {school.phone || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="inline-flex gap-1">
                      <button
                        title="View & Allocate IDs"
                        onClick={() => openViewModal(school)}
                        className="p-1.5 text-green-700 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Edit"
                        onClick={() => openEditModal(school)}
                        className="p-1.5 text-[#06013E] hover:bg-[#06013E]/10 border border-transparent hover:border-[#06013E]/20 transition-all"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title="Delete"
                        onClick={() => setDeleteTarget(school)}
                        className="p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Row */}
      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-600 flex justify-between items-center">
        <span>
          Showing <span className="font-bold">{filteredSchools.length}</span> of{' '}
          <span className="font-bold">{schools.length}</span> records
        </span>
        <span className="italic">© Mittsure Olympiad Portal</span>
      </div>

      {/* Manual Registration Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl p-0 border border-gray-300 rounded-none">
          <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Register New School
              </DialogTitle>
            </DialogHeader>
          </div>

          <form
            onSubmit={handleAddSchool}
            className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Official School Name <span className="text-red-600">*</span>
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                placeholder="e.g. Mittsure International School"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                CRM ID <span className="text-red-600">*</span>
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] font-mono"
                placeholder="OLYMP-2026-XXXX"
                value={formData.olympiadId}
                onChange={(e) => setFormData({ ...formData, olympiadId: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Contact Person
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                placeholder="Principal / Admin name"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Phone Number
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                placeholder="+91 XXXXX XXXXX"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Email Address
              </label>
              <Input
                type="email"
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                placeholder="school@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Full Postal Address
              </label>
              <textarea
                className="w-full min-h-[80px] border border-gray-300 p-2 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                placeholder="Street, city, state, PIN..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="flex gap-2 col-span-2 pt-2 justify-end">
              <Button
                variant="outline"
                type="button"
                className="rounded-none h-10 border-gray-400 font-semibold"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-none h-10 bg-[#06013E] hover:bg-[#0a0660] font-semibold"
              >
                Submit
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="max-w-md p-0 border border-gray-300 rounded-none">
          <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Bulk Registration
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-6 bg-white space-y-4">
            <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 p-3 text-xs text-gray-700">
              <FileSpreadsheet className="w-4 h-4 text-yellow-700 mt-0.5 shrink-0" />
              <p>
                Upload an Excel file (.xlsx) with required columns: School Name, CRM ID,
                State, District. Optional columns: Address, Email, Phone, Contact Person, City, Pincode.
              </p>
            </div>

            <label className="block border-2 border-dashed border-gray-400 p-6 text-center cursor-pointer hover:border-[#06013E] hover:bg-gray-50 transition-all">
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleFileUpload}
              />
              <Upload className="w-6 h-6 mx-auto text-gray-500 mb-2" />
              <div className="font-semibold text-sm text-gray-700">Choose Excel File</div>
              <div className="text-xs text-gray-500 mt-1">.xlsx / .xls only</div>
            </label>

            <Button
              variant="outline"
              className="w-full rounded-none h-10 border-gray-400 font-semibold text-[#06013E]"
            >
              <Download className="w-4 h-4 mr-2" /> Download Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-3xl !left-[calc(50%+9rem)] w-[min(90vw,48rem)]">
          <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Edit School {editingSchool?.schoolId ? `(${editingSchool.schoolId})` : ''}
              </DialogTitle>
            </DialogHeader>
          </div>

          <form
            onSubmit={handleUpdateSchool}
            className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Official School Name <span className="text-red-600">*</span>
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                CRM ID <span className="text-red-600">*</span>
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] font-mono"
                value={editFormData.olympiadId}
                onChange={(e) => setEditFormData({ ...editFormData, olympiadId: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Contact Person
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.contactPerson}
                onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Phone Number
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Email Address
              </label>
              <Input
                type="email"
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                State <span className="text-red-600">*</span>
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.state}
                onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                District <span className="text-red-600">*</span>
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.district}
                onChange={(e) => setEditFormData({ ...editFormData, district: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                City
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.city}
                onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Pincode
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.pincode}
                onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#06013E] mb-1.5 uppercase">
                Full Postal Address
              </label>
              <textarea
                className="w-full min-h-[80px] border border-gray-300 p-2 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.address}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </div>
            <div className="flex gap-2 col-span-2 pt-2 justify-end">
              <Button
                variant="outline"
                type="button"
                className="rounded-none h-10 border-gray-400 font-semibold"
                onClick={() => setIsEditModalOpen(false)}
                disabled={actionBusy}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-none h-10 bg-[#06013E] hover:bg-[#0a0660] font-semibold"
                disabled={actionBusy}
              >
                {actionBusy ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md p-0 border-0 rounded-2xl shadow-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>

          <div className="bg-white px-7 pt-7 pb-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4 ring-8 ring-red-50/40">
                <Trash className="w-7 h-7 text-red-600" strokeWidth={2.2} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Delete this school?
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                This will permanently remove the record. This action cannot be undone.
              </p>
            </div>

            {deleteTarget && (
              <div className="mt-5 bg-gray-50 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">School ID</span>
                  <span className="font-semibold text-gray-900 font-mono">
                    {deleteTarget.schoolId || '-'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Name</span>
                  <span className="font-semibold text-gray-900 truncate ml-3 max-w-[200px]">
                    {deleteTarget.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">CRM ID</span>
                  <span className="font-semibold text-gray-900 font-mono">
                    {deleteTarget.olympiadId}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="px-7 py-4 bg-gray-50 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={actionBusy}
              className="flex-1 h-11 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSchool}
              disabled={actionBusy}
              className="flex-1 h-11 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm shadow-red-600/20"
            >
              {actionBusy ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View / Allocate Modal */}
      <Dialog open={!!viewSchool} onOpenChange={(open) => !open && setViewSchool(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-4xl !left-[calc(50%+9rem)] w-[min(92vw,56rem)] max-h-[85vh] overflow-y-auto">
          <div className="bg-[#06013E] text-white px-6 py-3 border-b-4 border-[#FF9000] sticky top-0 z-10">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                School Details &amp; Olympiad ID Pool
                {viewSchool?.schoolId ? ` (${viewSchool.schoolId})` : ''}
              </DialogTitle>
            </DialogHeader>
          </div>

          {viewSchool && (
            <div className="p-6 bg-white space-y-5">
              {/* School info grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-gray-50 border border-gray-200 p-4">
                <InfoRow label="School Name" value={viewSchool.name} />
                <InfoRow label="School ID" value={viewSchool.schoolId} mono />
                <InfoRow label="CRM ID" value={viewSchool.olympiadId} mono />
                <InfoRow label="Contact Person" value={viewSchool.contactPerson} />
                <InfoRow label="Email" value={viewSchool.email} />
                <InfoRow label="Phone" value={viewSchool.phone} />
                <InfoRow
                  label="Location"
                  value={[viewSchool.city, viewSchool.state, viewSchool.pincode]
                    .filter(Boolean)
                    .join(', ')}
                />
                <InfoRow label="Address" value={viewSchool.address} />
              </div>

              {/* Allocation header */}
              <div className="flex items-center justify-between border-b-2 border-[#06013E] pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-[#06013E]">
                  <Hash className="w-4 h-4" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    Olympiad ID Pool ({allocations.length})
                  </h3>
                  {allocations.length > 0 && (
                    <span className="text-[10px] font-semibold text-gray-600 uppercase">
                      Sent: <span className="text-green-700">{allocations.filter((a) => a.sentAt).length}</span>
                      {' · '}
                      Pending: <span className="text-orange-700">{allocations.filter((a) => !a.sentAt).length}</span>
                    </span>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {allocations.length > 0 && allocations.some((a) => !a.sentAt) && (
                    <button
                      onClick={handleSendIds}
                      disabled={sendBusy}
                      className="inline-flex items-center gap-1.5 bg-green-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-green-800 transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {sendBusy ? 'Sending...' : `Send to School (${allocations.filter((a) => !a.sentAt).length})`}
                    </button>
                  )}
                  {allocations.length > 0 && (
                    <button
                      onClick={exportAllocationsCSV}
                      className="inline-flex items-center gap-1.5 bg-white border border-gray-400 text-[#06013E] px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </button>
                  )}
                  {!showAllocateForm && (
                    <button
                      onClick={() => {
                        setShowAllocateForm(true);
                        setAllocError(null);
                      }}
                      className="inline-flex items-center gap-1.5 bg-[#06013E] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#0a0660] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Allocate New IDs
                    </button>
                  )}
                </div>
              </div>

              {sendResult && (
                <div className="bg-green-50 border border-green-300 text-green-800 text-xs px-3 py-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {sendResult}
                </div>
              )}

              {/* Allocation form */}
              {showAllocateForm && (
                <form
                  onSubmit={handleAllocate}
                  className="bg-blue-50 border border-blue-200 p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#06013E] mb-1 uppercase">
                        Prefix <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        value={allocPrefix}
                        onChange={(e) => setAllocPrefix(e.target.value)}
                        className="w-full h-9 border border-gray-300 px-3 text-sm font-mono focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                        placeholder="e.g. MITT-DPS-26-"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#06013E] mb-1 uppercase">
                        Count <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={allocCount}
                        onChange={(e) => setAllocCount(parseInt(e.target.value || '0', 10))}
                        className="w-full h-9 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#06013E] mb-1 uppercase">
                        Padding (digits)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={allocPadding}
                        onChange={(e) => setAllocPadding(parseInt(e.target.value || '4', 10))}
                        className="w-full h-9 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-[#06013E] mb-1 uppercase">
                        Preview
                      </label>
                      <div className="h-9 bg-white border border-gray-300 px-3 flex items-center text-sm font-mono text-gray-700">
                        {allocPrefix || '---'}
                        {String(startSeq).padStart(Math.max(allocPadding, 1), '0')} ...{' '}
                        {allocPrefix || '---'}
                        {String(startSeq + (allocCount || 1) - 1).padStart(Math.max(allocPadding, 1), '0')}
                      </div>
                    </div>
                  </div>

                  {allocError && (
                    <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
                      {allocError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAllocateForm(false)}
                      disabled={allocBusy}
                      className="h-9 px-4 bg-white border border-gray-400 text-gray-700 font-semibold text-xs hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={allocBusy}
                      className="h-9 px-5 bg-[#06013E] text-white font-semibold text-xs hover:bg-[#0a0660] transition-colors disabled:opacity-50"
                    >
                      {allocBusy ? 'Allocating...' : `Generate ${allocCount} IDs`}
                    </button>
                  </div>
                </form>
              )}

              {/* Allocations table */}
              <div className="border border-gray-300 overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#E8EAF6] sticky top-0">
                      <tr className="border-b-2 border-[#06013E] text-[#06013E]">
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">
                          #
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">
                          Olympiad ID
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">
                          Delivery
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">
                          Allocated On
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocLoading ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#06013E]" />
                          </td>
                        </tr>
                      ) : allocations.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">
                            No Olympiad IDs allocated yet. Click "Allocate New IDs" to generate.
                          </td>
                        </tr>
                      ) : (
                        allocations.map((a, idx) => (
                          <tr
                            key={a.id}
                            className={`border-b border-gray-200 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                          >
                            <td className="px-3 py-2 border-r border-gray-200 text-gray-700 text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-200 font-mono font-semibold text-[#06013E]">
                              {a.code}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-200">
                              {a.sentAt ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase bg-green-100 text-green-800 border border-green-300"
                                  title={`Sent on ${new Date(a.sentAt).toLocaleString()}`}
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Sent
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-orange-100 text-orange-800 border border-orange-300">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-700 text-xs">
                              {new Date(a.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide w-32 shrink-0">
        {label}
      </span>
      <span className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''} break-words`}>
        {value || '-'}
      </span>
    </div>
  );
}
