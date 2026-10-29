'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
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
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { STATES, STATE_CODE_BY_NAME, getDistrictsForState, findDistrictByName } from '@/lib/locations';
import { CLASSES } from '@/lib/classes';
import { olympiadPrefixForCrm } from '@/lib/olympiadIdFormat';

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
  district?: string;
  districtCode?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  isActive?: boolean;
  examDate?: string | null;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') || '' : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const SCHOOLS_PAGE_SIZE = 25;

// Olympiad IDs bucketed by class for the ID pool table, in CLASSES order
// (Nursery → LKG → UKG); anything with an unknown or missing class goes last.
function groupAllocationsByClass(allocations: any[]) {
  const groups = new Map<string, any[]>();
  for (const a of allocations) {
    const key = a.className || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  }
  const rank = (name: string) => {
    const i = CLASSES.findIndex((c) => c.name === name);
    return i === -1 ? CLASSES.length : i;
  };
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([className, items]) => ({ className, items }));
}

export default function SchoolsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(searchTerm.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);
  const schoolsQuery = new URLSearchParams({ page: String(page), pageSize: String(SCHOOLS_PAGE_SIZE), q: debouncedSearch });
  const {
    data: schoolsData,
    isLoading: schoolsLoading,
    mutate: mutateSchools,
  } = useSWR<{ schools: School[]; total: number; totalAll: number; page: number; pageSize: number }>(
    `/api/schools?${schoolsQuery}`,
    fetcher,
    { keepPreviousData: true },
  );
  const schools: School[] = Array.isArray(schoolsData?.schools) ? schoolsData.schools : [];
  const totalMatching = schoolsData?.total ?? 0;
  const totalSchools = schoolsData?.totalAll ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMatching / SCHOOLS_PAGE_SIZE));
  // After a delete empties the last page, step back to the new last page.
  useEffect(() => {
    if (schoolsData && page > totalPages) setPage(totalPages);
  }, [schoolsData, page, totalPages]);
  const loading = schoolsLoading;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<School | null>(null);
  const [toggleTarget, setToggleTarget] = useState<School | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // View / Allocation state
  const [viewSchool, setViewSchool] = useState<School | null>(null);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [allocLoading, setAllocLoading] = useState(false);
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [allocClasses, setAllocClasses] = useState<
    { classCode: string; className: string; count: number }[]
  >([{ classCode: '', className: '', count: 10 }]);
  const [allocBusy, setAllocBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [allocError, setAllocError] = useState<string | null>(null);
  // Unallotted IDs ticked for deletion (see DELETE /api/schools/[id]/olympiad-ids).
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [lastClickedCode, setLastClickedCode] = useState<string | null>(null);
  const [deleteIdsBusy, setDeleteIdsBusy] = useState(false);
  const [deleteIdsError, setDeleteIdsError] = useState<string | null>(null);

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
    districtCode: '',
    state: '',
    stateCode: '',
    pincode: '',
    examDate: '',
  });

  const editDistrictOptions = getDistrictsForState(editFormData.stateCode);

  const handleEditStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stateCode = e.target.value;
    const state = STATES.find((s) => s.code === stateCode);
    setEditFormData({
      ...editFormData,
      stateCode,
      state: state?.name || '',
      districtCode: '',
      district: '',
    });
  };

  const handleEditDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const districtCode = e.target.value;
    const district = editDistrictOptions.find((d) => d.code === districtCode);
    setEditFormData({
      ...editFormData,
      districtCode,
      district: district?.name || '',
    });
  };

  // Re-fetch the schools list (used after add / edit / delete).
  const fetchSchools = () => mutateSchools();

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: authHeaders(),
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

    // Older records may only have plain state/district names with no code —
    // resolve the code from the name so the dropdowns pre-select correctly.
    const stateCode = school.stateCode || STATE_CODE_BY_NAME[school.state] || '';
    const districtCode =
      school.districtCode ||
      findDistrictByName(stateCode, school.district)?.code ||
      '';

    setEditFormData({
      name: school.name || '',
      olympiadId: school.olympiadId || '',
      address: school.address || '',
      email: school.email || '',
      phone: school.phone || '',
      contactPerson: school.contactPerson || '',
      city: school.city || '',
      district: school.district || '',
      districtCode,
      state: school.state || '',
      stateCode,
      pincode: school.pincode || '',
      examDate: school.examDate ? String(school.examDate).slice(0, 10) : '',
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
        headers: authHeaders(),
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
    setAllocClasses([{ classCode: '', className: '', count: 10 }]);
    setSelectedCodes(new Set());
    setLastClickedCode(null);
    setDeleteIdsError(null);
    setAllocLoading(true);

    try {
      const res = await fetch(`/api/schools/${school.id}/olympiad-ids`, { headers: authHeaders() });
      const data = await res.json();
      const loadedAllocations = Array.isArray(data) ? data : [];
      setAllocations(loadedAllocations);
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
      const res = await fetch(`/api/schools/${schoolId}/olympiad-ids`, { headers: authHeaders() });
      const data = await res.json();
      setAllocations(Array.isArray(data) ? data : []);
      setSelectedCodes(new Set());
      setLastClickedCode(null);
    } finally {
      setAllocLoading(false);
    }
  };

  // Shift-click ticks every unallotted ID between the last click and this one,
  // so trimming a class by 20 IDs doesn't take 20 clicks.
  const toggleCodeSelection = (code: string, shiftKey: boolean) => {
    const ordered = groupAllocationsByClass(allocations).flatMap((g) => g.items).filter((a) => !a.inUse);
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      const select = !prev.has(code);
      const from = shiftKey && lastClickedCode ? ordered.findIndex((a) => a.code === lastClickedCode) : -1;
      const to = ordered.findIndex((a) => a.code === code);
      if (from !== -1 && to !== -1) {
        const [lo, hi] = from < to ? [from, to] : [to, from];
        for (const a of ordered.slice(lo, hi + 1)) {
          if (select) next.add(a.code); else next.delete(a.code);
        }
      } else if (select) next.add(code);
      else next.delete(code);
      return next;
    });
    setLastClickedCode(code);
  };

  const toggleClassSelection = (items: any[]) => {
    const unused = items.filter((a) => !a.inUse).map((a) => a.code);
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      const allSelected = unused.length > 0 && unused.every((c) => prev.has(c));
      for (const c of unused) {
        if (allSelected) next.delete(c); else next.add(c);
      }
      return next;
    });
  };

  const handleDeleteIds = async () => {
    if (!viewSchool || selectedCodes.size === 0) return;
    const codes = [...selectedCodes];
    const sentCount = allocations.filter((a) => selectedCodes.has(a.code) && a.sentAt).length;
    const warning = sentCount > 0
      ? `\n\n${sentCount} of these were already sent to the school and will disappear from its portal.`
      : '';
    if (!confirm(`Permanently delete ${codes.length} unallotted Olympiad ID(s) from ${viewSchool.name}? This cannot be undone.${warning}`)) return;

    setDeleteIdsBusy(true);
    setDeleteIdsError(null);
    try {
      const res = await fetch(`/api/schools/${viewSchool.id}/olympiad-ids`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ codes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteIdsError(data.message || 'Failed to delete IDs');
      } else {
        setSendResult(`${data.deleted} unallotted ID(s) deleted.`);
        setTimeout(() => setSendResult(null), 4000);
      }
      refreshAllocations(viewSchool.id);
    } catch {
      setDeleteIdsError('Network error while deleting IDs');
    } finally {
      setDeleteIdsBusy(false);
    }
  };

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewSchool) return;
    setAllocError(null);

    if (allocClasses.some((c) => !c.className.trim())) {
      setAllocError('Class is required for every row');
      return;
    }
    const totalCount = allocClasses.reduce((sum, c) => sum + (c.count || 0), 0);
    if (!totalCount || totalCount < 1 || totalCount > 1000) {
      setAllocError('Total count across classes must be between 1 and 1000');
      return;
    }
    if (allocClasses.some((c) => !c.count || c.count < 1)) {
      setAllocError('Each class must have a count of at least 1');
      return;
    }

    setAllocBusy(true);
    try {
      const res = await fetch(`/api/schools/${viewSchool.id}/olympiad-ids`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          classes: allocClasses.map((c) => ({
            className: c.className.trim(),
            count: c.count,
          })),
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
        headers: authHeaders(),
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
      ['Olympiad ID', 'Class', 'Delivery', 'Allocated On'],
      ...groupAllocationsByClass(allocations).flatMap((g) => g.items).map((a) => [
        a.code,
        a.className || '',
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
        headers: authHeaders(),
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

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    setActionBusy(true);
    try {
      const res = await fetch(`/api/schools/${toggleTarget.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });
      if (res.ok) {
        setToggleTarget(null);
        fetchSchools();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'Failed to update status');
      }
    } catch (error) {
      alert('Network error while updating status');
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
          headers: authHeaders(),
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

  // New IDs always use the 6-digit CRM prefix (lib/olympiadIdFormat) and
  // continue that prefix's sequence; IDs from the old format keep their own.
  const allocPrefix = viewSchool ? olympiadPrefixForCrm(viewSchool.olympiadId || '') ?? '' : '';
  const lastAllocationWithPrefix = allocations
    .filter((a) => a.prefix === allocPrefix)
    .reduce((max, a) => (a.sequence > max ? a.sequence : max), 0);
  const startSeq = lastAllocationWithPrefix + 1;

  // Search runs server-side (see /api/schools GET); this is just the current page.
  const filteredSchools = schools;
  const rowOffset = (page - 1) * SCHOOLS_PAGE_SIZE;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-[#004f9f]">School Directory</h1>
    <div className="bg-white border border-gray-300 shadow-sm">

      {/* Action Bar */}
      <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">Total Registered Schools:</span>
          <span className="font-bold text-[#004f9f]">{totalSchools}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="inline-flex items-center gap-2 bg-white border border-gray-400 text-[#004f9f] px-4 py-2 text-sm font-semibold hover:bg-gray-100 transition-colors"
          >
            <Upload className="w-4 h-4" /> Bulk Register
          </button>
          <button
            onClick={() => router.push('/dashboard/schools/register')}
            className="inline-flex items-center gap-2 bg-[#009846] text-white px-4 py-2 text-sm font-semibold hover:bg-[#007a38] transition-colors"
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
            <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#004f9f]">
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
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">
                Exam Date
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-36">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#004f9f] mb-2" />
                  <p className="text-gray-600 text-sm">Loading records...</p>
                </td>
              </tr>
            ) : filteredSchools.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <p className="text-gray-500 text-sm">No records found.</p>
                </td>
              </tr>
            ) : (
              filteredSchools.map((school, idx) => {
                const inactive = school.isActive === false;
                return (
                <tr
                  key={school.id}
                  className={`border-b border-gray-200 transition-colors ${
                    inactive
                      ? 'bg-red-50/60 opacity-60 hover:opacity-80'
                      : idx % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-gray-50 hover:bg-yellow-50'
                  }`}
                >
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">
                    {rowOffset + idx + 1}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#004f9f] tracking-tight tabular-nums">
                        {school.schoolId || '-'}
                      </span>
                      {inactive && (
                        <span className="text-[9px] font-bold uppercase bg-red-100 text-red-600 border border-red-300 px-1.5 py-0.5 leading-none">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-gray-600 tracking-tight tabular-nums text-[13px]">
                    {school.olympiadId}
                  </td>
                  <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900 tracking-[-0.01em]">
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
                  <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">
                    {school.examDate ? new Date(school.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
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
                        className="p-1.5 text-[#004f9f] hover:bg-[#06013E]/10 border border-transparent hover:border-[#06013E]/20 transition-all"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={inactive ? 'Mark Active' : 'Mark Inactive'}
                        onClick={() => setToggleTarget(school)}
                        className={`p-1.5 border border-transparent transition-all ${
                          inactive
                            ? 'text-green-600 hover:bg-green-50 hover:border-green-200'
                            : 'text-orange-500 hover:bg-orange-50 hover:border-orange-200'
                        }`}
                      >
                        {inactive ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Row */}
      <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-200 flex justify-between items-center">
        <span>
          Showing{' '}
          <span className="font-bold">
            {totalMatching === 0 ? 0 : rowOffset + 1}–{rowOffset + filteredSchools.length}
          </span>{' '}
          of <span className="font-bold">{totalMatching}</span> records
        </span>
        <div className="flex items-center gap-2 text-gray-700">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="border border-gray-300 bg-white p-1.5 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="tabular-nums">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border border-gray-300 bg-white p-1.5 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <span className="italic">© mittmee</span>
      </div>

      {/* Manual Registration Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl p-0 border border-gray-300 rounded-none">
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000]">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
                className="rounded-none h-10 bg-[#009846] text-white hover:bg-[#007a38] font-semibold"
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
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000]">
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
              className="w-full rounded-none h-10 border-gray-400 font-semibold text-[#004f9f]"
            >
              <Download className="w-4 h-4 mr-2" /> Download Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-3xl !left-[calc(50%+9rem)] w-[min(90vw,48rem)] max-h-[85vh] overflow-y-auto">
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000] sticky top-0 z-10">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
                Contact Person
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.contactPerson}
                onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
                Phone Number
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
                State <span className="text-red-600">*</span>
              </label>
              <select
                value={editFormData.stateCode}
                onChange={handleEditStateChange}
                required
                className="w-full h-10 border border-gray-300 rounded-none px-3 text-sm bg-white focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
              >
                <option value="">Select State</option>
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
                District <span className="text-red-600">*</span>
              </label>
              <select
                value={editFormData.districtCode}
                onChange={handleEditDistrictChange}
                required
                disabled={!editFormData.stateCode}
                className="w-full h-10 border border-gray-300 rounded-none px-3 text-sm bg-white focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E] disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">{editFormData.stateCode ? 'Select District' : 'Select State first'}</option>
                {editDistrictOptions.map((d) => (
                  <option key={d.code} value={d.code}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
                City
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.city}
                onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
                Pincode
              </label>
              <Input
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.pincode}
                onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
                Exam Date
              </label>
              <Input
                type="date"
                className="h-10 rounded-none border-gray-300 focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                value={editFormData.examDate}
                onChange={(e) => setEditFormData({ ...editFormData, examDate: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#004f9f] mb-1.5 uppercase">
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
                className="rounded-none h-10 bg-[#009846] text-white hover:bg-[#007a38] font-semibold"
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

      {/* Toggle Active/Inactive Confirm Dialog */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent className="max-w-md p-0 border border-gray-300 rounded-none shadow-lg overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirm Status Change</DialogTitle>
          </DialogHeader>

          <div className={`px-6 py-3 border-b-4 ${toggleTarget?.isActive === false ? 'bg-[#009846] border-[#FF9000]' : 'bg-orange-500 border-[#FF9000]'}`}>
            <div className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-base font-bold uppercase tracking-wider">
                {toggleTarget?.isActive === false ? 'Activate School' : 'Deactivate School'}
              </span>
            </div>
          </div>

          <div className="bg-white px-6 py-5 space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              {toggleTarget?.isActive === false
                ? 'The school will be reactivated. Students and other users associated with it will regain full access to the app.'
                : 'The school will be marked inactive. No student or any other user linked to this school will be able to use the app until it is reactivated.'}
            </p>

            {toggleTarget && (
              <div className="bg-gray-50 border border-gray-200 p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">School ID</span>
                  <span className="font-bold text-[#004f9f] font-mono">{toggleTarget.schoolId || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Name</span>
                  <span className="font-bold text-gray-900 truncate ml-4 max-w-[210px] text-right">{toggleTarget.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Current Status</span>
                  <span className={`font-bold ${toggleTarget.isActive === false ? 'text-red-600' : 'text-green-600'}`}>
                    {toggleTarget.isActive === false ? 'Inactive' : 'Active'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex gap-3">
            <button
              type="button"
              onClick={() => setToggleTarget(null)}
              disabled={actionBusy}
              className="flex-1 h-10 border border-gray-400 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleToggleActive}
              disabled={actionBusy}
              className={`flex-1 h-10 text-white font-semibold text-sm transition-colors disabled:opacity-50 ${
                toggleTarget?.isActive === false
                  ? 'bg-[#009846] hover:bg-[#007a38]'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {actionBusy ? 'Updating...' : toggleTarget?.isActive === false ? 'Yes, Activate' : 'Yes, Deactivate'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View / Allocate Modal */}
      <Dialog open={!!viewSchool} onOpenChange={(open) => !open && setViewSchool(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-4xl !left-[calc(50%+9rem)] w-[min(92vw,56rem)] max-h-[85vh] overflow-y-auto">
          <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000] sticky top-0 z-10">
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
                <InfoRow
                  label="Exam Date"
                  value={viewSchool.examDate ? new Date(viewSchool.examDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined}
                />
              </div>

              {/* Allocation header */}
              <div className="flex items-center justify-between border-b-2 border-[#06013E] pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-[#004f9f]">
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
                  {selectedCodes.size > 0 && (
                    <button
                      onClick={handleDeleteIds}
                      disabled={deleteIdsBusy}
                      className="inline-flex items-center gap-1.5 bg-red-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-800 transition-colors disabled:opacity-50"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      {deleteIdsBusy ? 'Deleting...' : `Delete Selected (${selectedCodes.size})`}
                    </button>
                  )}
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
                      className="inline-flex items-center gap-1.5 bg-white border border-gray-400 text-[#004f9f] px-3 py-1.5 text-xs font-semibold hover:bg-gray-100 transition-colors"
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
                      className="inline-flex items-center gap-1.5 bg-[#009846] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#007a38] transition-colors"
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

              {deleteIdsError && (
                <div className="bg-red-50 border border-red-300 text-red-800 text-xs px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {deleteIdsError}
                </div>
              )}

              {allocations.some((a) => !a.inUse) && (
                <p className="text-[11px] text-gray-600">
                  Tick unallotted IDs to delete them (shift-click to select a range). IDs already allotted to a student are locked.
                </p>
              )}

              {/* Allocation form */}
              {showAllocateForm && (
                <form
                  onSubmit={handleAllocate}
                  className="bg-blue-50 border border-blue-200 p-4 space-y-3"
                >
                  <div className="text-xs text-gray-700">
                    ID format (fixed, 11 characters):{' '}
                    <span className="font-mono font-semibold text-[#004f9f]">
                      {allocPrefix || 'invalid CRM ID'} + class letter + 4-digit number
                    </span>
                  </div>

                  {/* Per-class breakdown */}
                  <div>
                    <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">
                      Class-wise Count <span className="text-red-600">*</span>
                    </label>
                    <div className="space-y-2">
                      {allocClasses.map((row, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={row.className}
                            onChange={(e) => {
                              const name = e.target.value;
                              const match = CLASSES.find((c) => c.name === name);
                              setAllocClasses((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, className: name, classCode: match?.code ?? r.classCode }
                                    : r
                                )
                              );
                            }}
                            className="col-span-7 h-9 border border-gray-300 px-3 text-sm bg-white focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                            required
                          >
                            <option value="" disabled>
                              Select class
                            </option>
                            {CLASSES.map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={row.count}
                            onChange={(e) => {
                              const v = parseInt(e.target.value || '0', 10);
                              setAllocClasses((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, count: v } : r))
                              );
                            }}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="Count"
                            className="col-span-4 h-9 border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
                            required
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setAllocClasses((prev) =>
                                prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev
                              )
                            }
                            disabled={allocClasses.length === 1}
                            className="col-span-1 h-9 flex items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Remove class"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAllocClasses((prev) => [
                          ...prev,
                          { classCode: '', className: '', count: 10 },
                        ])
                      }
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#004f9f] hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add another class
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#004f9f] mb-1 uppercase">
                      Preview
                    </label>
                    <div className="h-9 bg-white border border-gray-300 px-3 flex items-center text-sm font-mono text-gray-700">
                      {allocPrefix || '---'}
                      {allocClasses[0]?.classCode || ''}
                      {String(startSeq).padStart(4, '0')} ...{' '}
                      {allocPrefix || '---'}
                      {allocClasses[allocClasses.length - 1]?.classCode || ''}
                      {String(
                        startSeq + allocClasses.reduce((sum, c) => sum + (c.count || 0), 0) - 1
                      ).padStart(4, '0')}
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
                      className="h-9 px-5 bg-[#009846] text-white font-semibold text-xs hover:bg-[#007a38] transition-colors disabled:opacity-50"
                    >
                      {allocBusy
                        ? 'Allocating...'
                        : `Generate ${allocClasses.reduce((sum, c) => sum + (c.count || 0), 0)} IDs`}
                    </button>
                  </div>
                </form>
              )}

              {/* Allocations table */}
              <div className="border border-gray-300 overflow-hidden">
                <div className="max-h-72 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#E8EAF6] sticky top-0">
                      <tr className="border-b-2 border-[#06013E] text-[#004f9f]">
                        <th className="px-2 py-2 border-r border-gray-300 w-8" aria-label="Select" />
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
                          <td colSpan={5} className="py-8 text-center">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#004f9f]" />
                          </td>
                        </tr>
                      ) : allocations.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-500 text-sm">
                            No Olympiad IDs allocated yet. Click "Allocate New IDs" to generate.
                          </td>
                        </tr>
                      ) : (
                        groupAllocationsByClass(allocations).map(({ className, items }) => (
                          <Fragment key={className || 'no-class'}>
                          <tr className="bg-[#004f9f]/10 border-b border-[#004f9f]/30">
                            <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                              {items.some((a) => !a.inUse) && (
                                <input
                                  type="checkbox"
                                  checked={items.filter((a) => !a.inUse).every((a) => selectedCodes.has(a.code))}
                                  onChange={() => toggleClassSelection(items)}
                                  title={`Select all unallotted ${className || ''} IDs`}
                                  className="accent-red-700"
                                />
                              )}
                            </td>
                            <td colSpan={4} className="px-3 py-1.5 text-xs font-bold uppercase text-[#004f9f]">
                              {className || 'No class'}
                              <span className="ml-2 font-semibold normal-case text-gray-600">
                                {items.length} {items.length === 1 ? 'ID' : 'IDs'}
                                {' · '}Sent: <span className="text-green-700">{items.filter((a) => a.sentAt).length}</span>
                                {' · '}Pending: <span className="text-orange-700">{items.filter((a) => !a.sentAt).length}</span>
                                {' · '}Allotted: <span className="text-[#004f9f]">{items.filter((a) => a.inUse).length}</span>
                              </span>
                            </td>
                          </tr>
                          {items.map((a, idx) => (
                          <tr
                            key={a.id}
                            className={`border-b border-gray-200 ${
                              idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                            }`}
                          >
                            <td className="px-2 py-2 border-r border-gray-200 text-center">
                              {a.inUse ? (
                                <span title="Allotted to a student — cannot be deleted" className="text-gray-400 text-[10px]">—</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={selectedCodes.has(a.code)}
                                  onChange={() => {}}
                                  onClick={(e) => toggleCodeSelection(a.code, e.shiftKey)}
                                  className="accent-red-700"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-200 text-gray-700 text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2 border-r border-gray-200 font-mono font-semibold text-[#004f9f]">
                              {a.code}
                              {a.inUse && (
                                <span className="ml-2 inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase font-sans bg-blue-100 text-blue-800 border border-blue-300">
                                  Allotted
                                </span>
                              )}
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
                          ))}
                          </Fragment>
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

