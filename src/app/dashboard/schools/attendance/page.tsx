'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  ClipboardCheck, Search, Loader2, Eye, Download, FileText,
  CheckCircle2, Clock, AlertCircle, XCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { fetcher } from '@/lib/swr';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SchoolAttendanceRow {
  id: string;
  schoolId?: string;
  olympiadId?: string;
  name: string;
  city?: string;
  state?: string;
  examDate: string;
  attendanceSubmittedAt: string | null;
  total: number;
  marked: number;
  present: number;
  absent: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_TO_SUBMIT' | 'SUBMITTED';
}

interface StudentRow {
  name: string;
  phone: string;
  olympiadCode: string;
  className: string | null;
  status: 'PRESENT' | 'ABSENT' | 'UNMARKED';
  markedAt: string | null;
}

interface SchoolDetail {
  school: {
    id: string; schoolId?: string; olympiadId?: string; name: string; city?: string; state?: string; district?: string;
    contactPerson?: string; email?: string; phone?: string; examDate: string; attendanceSubmittedAt: string | null;
  };
  summary: { total: number; present: number; absent: number; unmarked: number };
  students: StudentRow[];
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') || '' : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

const STATUS_LABEL: Record<SchoolAttendanceRow['status'], string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  READY_TO_SUBMIT: 'Ready to submit',
  SUBMITTED: 'Submitted',
};

const STATUS_STYLE: Record<SchoolAttendanceRow['status'], string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600 border-gray-300',
  IN_PROGRESS: 'bg-orange-100 text-orange-800 border-orange-300',
  READY_TO_SUBMIT: 'bg-blue-100 text-blue-800 border-blue-300',
  SUBMITTED: 'bg-green-100 text-green-800 border-green-300',
};

const STATUS_ICON: Record<SchoolAttendanceRow['status'], React.ComponentType<{ className?: string }>> = {
  NOT_STARTED: XCircle,
  IN_PROGRESS: Clock,
  READY_TO_SUBMIT: AlertCircle,
  SUBMITTED: CheckCircle2,
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

// ─── Report builders (shared by aggregate + drill-down exports) ───────────

function buildAggregatePDF(rows: SchoolAttendanceRow[]) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFillColor(0, 79, 159);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setFillColor(255, 144, 0);
  doc.rect(0, 26, pageWidth, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('MITTSURE', margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 197, 120);
  doc.text(' OLYMPIAD', margin + doc.getTextWidth('MITTSURE'), 12);

  doc.setFontSize(8.5);
  doc.setTextColor(220, 232, 245);
  doc.text('EXAM ATTENDANCE — ALL SCHOOLS OVERVIEW', margin, 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, pageWidth - margin, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 232, 245);
  doc.text(`${rows.length} school(s)`, pageWidth - margin, 17, { align: 'right' });

  autoTable(doc, {
    startY: 34,
    head: [['School', 'CRM ID', 'Location', 'Exam Date', 'Total', 'Present', 'Absent', 'Status', 'Submitted On']],
    body: rows.map((r) => [
      r.name,
      r.olympiadId || '-',
      [r.city, r.state].filter(Boolean).join(', ') || '-',
      fmtDate(r.examDate),
      String(r.total),
      String(r.present),
      String(r.absent),
      STATUS_LABEL[r.status],
      r.attendanceSubmittedAt ? fmtDateTime(r.attendanceSubmittedAt) : '-',
    ]),
    headStyles: { fillColor: [0, 79, 159], fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 3 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    theme: 'grid',
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = data.cell.raw;
        if (val === 'Submitted') { data.cell.styles.textColor = [4, 120, 87]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'Ready to submit') { data.cell.styles.textColor = [30, 64, 175]; }
        else if (val === 'In progress') { data.cell.styles.textColor = [180, 83, 9]; }
      }
    },
  });

  const pageCount = doc.internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text('mittsure Olympiad Management — Confidential', margin, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save('olympiad-attendance-overview.pdf');
}

function buildAggregateExcel(rows: SchoolAttendanceRow[]) {
  const headers = ['School', 'CRM ID', 'City', 'State', 'Exam Date', 'Total Students', 'Present', 'Absent', 'Status', 'Submitted On'];
  const data = rows.map((r) => [
    r.name, r.olympiadId || '', r.city || '', r.state || '', fmtDate(r.examDate),
    r.total, r.present, r.absent, STATUS_LABEL[r.status],
    r.attendanceSubmittedAt ? fmtDateTime(r.attendanceSubmittedAt) : '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Overview');
  XLSX.writeFile(wb, 'olympiad-attendance-overview.xlsx');
}

function buildSchoolPDF(detail: SchoolDetail) {
  const { school, summary, students } = detail;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Letterhead band
  doc.setFillColor(0, 79, 159);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(255, 144, 0);
  doc.rect(0, 30, pageWidth, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('MITTSURE', margin, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(255, 197, 120);
  doc.text(' OLYMPIAD', margin + doc.getTextWidth('MITTSURE'), 13);

  doc.setFontSize(8.5);
  doc.setTextColor(220, 232, 245);
  doc.text('EXAM ATTENDANCE REPORT', margin, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`Generated ${fmtDateTime(new Date().toISOString())}`, pageWidth - margin, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 232, 245);
  doc.text(
    school.attendanceSubmittedAt ? `Submitted ${fmtDateTime(school.attendanceSubmittedAt)}` : 'Not yet submitted',
    pageWidth - margin, 18, { align: 'right' }
  );

  // School name — the headline of the report
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39);
  doc.text(school.name, margin, 42);

  const locLine = [school.city, school.district, school.state].filter(Boolean).join(', ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`School ID ${school.schoolId || '-'}   ·   CRM ID ${school.olympiadId || '-'}   ·   ${locLine || '-'}`, margin, 49);

  doc.setDrawColor(229, 231, 235);
  doc.line(margin, 54, pageWidth - margin, 54);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(55, 65, 81);
  doc.text(`Exam Date: ${fmtDate(school.examDate)}`, margin, 61);

  // Summary stat boxes
  const stats: [string, number, [number, number, number]][] = [
    ['Total', summary.total, [55, 65, 81]],
    ['Present', summary.present, [180, 130, 0]],
    ['Absent', summary.absent, [220, 38, 38]],
    ['Unmarked', summary.unmarked, [156, 163, 175]],
  ];
  const boxW = (pageWidth - margin * 2 - 3 * 4) / 4;
  let bx = margin;
  const boxY = 67;
  for (const [label, value, color] of stats) {
    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(bx, boxY, boxW, 18, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    doc.text(label.toUpperCase(), bx + boxW / 2, boxY + 6, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...color);
    doc.text(String(value), bx + boxW / 2, boxY + 14, { align: 'center' });
    bx += boxW + 4;
  }

  autoTable(doc, {
    startY: boxY + 26,
    head: [['#', 'Olympiad ID', 'Student Name', 'Class', 'Phone', 'Status']],
    body: students.map((s, i) => [
      String(i + 1), s.olympiadCode, s.name, s.className || '-', s.phone,
      s.status === 'PRESENT' ? 'Present' : s.status === 'ABSENT' ? 'Absent' : 'Unmarked',
    ]),
    headStyles: { fillColor: [0, 79, 159], fontSize: 8.5, halign: 'left' },
    styles: { fontSize: 8.5, cellPadding: 3 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    theme: 'grid',
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = data.cell.raw;
        if (val === 'Present') { data.cell.styles.textColor = [180, 130, 0]; data.cell.styles.fontStyle = 'bold'; }
        else if (val === 'Absent') { data.cell.styles.textColor = [220, 38, 38]; data.cell.styles.fontStyle = 'bold'; }
        else { data.cell.styles.textColor = [156, 163, 175]; }
      }
    },
  });

  const pageCount = doc.internal.pages.length - 1;
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text('mittsure Olympiad Management — Confidential', margin, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save(`attendance-${school.schoolId || school.name}.pdf`);
}

function buildSchoolExcel(detail: SchoolDetail) {
  const { school, students } = detail;
  const headers = ['#', 'Olympiad ID', 'Student Name', 'Class', 'Phone', 'Status'];
  const data = students.map((s, i) => [
    i + 1, s.olympiadCode, s.name, s.className || '', s.phone,
    s.status === 'PRESENT' ? 'Present' : s.status === 'ABSENT' ? 'Absent' : 'Unmarked',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws['!cols'] = headers.map(() => ({ wch: 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `attendance-${school.schoolId || school.name}.xlsx`);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SchoolAttendancePage() {
  const { data, isLoading } = useSWR<SchoolAttendanceRow[]>('/api/schools/attendance', fetcher);
  const rows: SchoolAttendanceRow[] = Array.isArray(data) ? data : [];

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SchoolAttendanceRow['status']>('ALL');

  const [viewSchoolId, setViewSchoolId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (searchTerm && !r.name.toLowerCase().includes(searchTerm.toLowerCase()) && !(r.schoolId || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [rows, searchTerm, statusFilter]);

  const totals = useMemo(() => ({
    schools: rows.length,
    submitted: rows.filter((r) => r.status === 'SUBMITTED').length,
    students: rows.reduce((sum, r) => sum + r.total, 0),
    present: rows.reduce((sum, r) => sum + r.present, 0),
  }), [rows]);

  const openView = async (id: string) => {
    setViewSchoolId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/schools/${id}/attendance`, { headers: authHeaders() });
      const json = await res.json();
      setDetail(json);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-medium text-[#004f9f]">Exam Attendance Reports</h1>

      <div className="bg-white border border-gray-300 shadow-sm">
        {/* Summary strip */}
        <div className="bg-gray-50 border-b border-gray-300 px-6 py-3 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Schools scheduled:</span>
            <span className="font-bold text-[#004f9f]">{totals.schools}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Submitted:</span>
            <span className="font-bold text-green-700">{totals.submitted}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Total students:</span>
            <span className="font-bold text-[#004f9f]">{totals.students}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Total present:</span>
            <span className="font-bold text-green-700">{totals.present}</span>
          </div>

          <div className="ml-auto flex gap-2">
            <button
              onClick={() => buildAggregatePDF(filtered)}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 bg-white border border-gray-400 text-[#004f9f] px-3 py-2 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" /> Export PDF
            </button>
            <button
              onClick={() => buildAggregateExcel(filtered)}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 bg-white border border-gray-400 text-[#004f9f] px-3 py-2 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-300 bg-white flex flex-wrap items-center gap-3">
          <div className="relative max-w-md flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by school name or School ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-[#06013E] focus:ring-1 focus:ring-[#06013E]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'READY_TO_SUBMIT', 'SUBMITTED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  statusFilter === s
                    ? 'bg-[#004f9f] text-white border-[#004f9f]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#004f9f]'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[#E8EAF6] border-b-2 border-[#06013E] text-[#004f9f]">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300 w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">School</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">CRM ID</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Location</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Exam Date</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-gray-300">Total</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-gray-300">Present</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-gray-300">Absent</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-gray-300">Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider w-20">View</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#004f9f] mb-2" />
                    <p className="text-gray-600 text-sm">Loading attendance records...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <p className="text-gray-500 text-sm">No schools with a scheduled exam date match your filters.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const StatusIcon = STATUS_ICON[r.status];
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-gray-200 transition-colors ${idx % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-gray-50 hover:bg-yellow-50'}`}
                    >
                      <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">{idx + 1}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200 font-semibold text-gray-900">
                        {r.name}
                        {r.schoolId && <span className="ml-2 font-mono text-xs text-gray-400">{r.schoolId}</span>}
                      </td>
                      <td className="px-4 py-2.5 border-r border-gray-200 font-mono text-gray-600 text-xs">{r.olympiadId || '-'}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">{[r.city, r.state].filter(Boolean).join(', ') || '-'}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200 text-gray-700">{fmtDate(r.examDate)}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200 text-center font-semibold text-gray-800">{r.total}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200 text-center font-semibold text-green-700">{r.present}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200 text-center font-semibold text-red-700">{r.absent}</td>
                      <td className="px-4 py-2.5 border-r border-gray-200">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase border ${STATUS_STYLE[r.status]}`}>
                          <StatusIcon className="w-3 h-3" /> {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          title="View report"
                          onClick={() => openView(r.id)}
                          className="p-1.5 text-green-700 hover:bg-green-50 border border-transparent hover:border-green-200 transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 border-t border-gray-300 px-6 py-2 text-xs text-gray-500 flex justify-between items-center">
          <span>Showing <span className="font-bold">{filtered.length}</span> of <span className="font-bold">{rows.length}</span> schools</span>
          <span className="italic">© mittmee</span>
        </div>
      </div>

      {/* Drill-down modal */}
      <Dialog open={!!viewSchoolId} onOpenChange={(open) => !open && setViewSchoolId(null)}>
        <DialogContent className="p-0 border border-gray-300 rounded-none sm:!max-w-4xl !left-[calc(50%+9rem)] w-[min(92vw,56rem)] max-h-[85vh] overflow-y-auto">
          <div className="bg-[#009846] text-white pl-6 pr-16 py-3 border-b-4 border-[#FF9000] sticky top-0 z-10 flex items-center justify-between">
            <DialogHeader>
              <DialogTitle className="text-base font-bold uppercase tracking-wider">
                Attendance Report {detail?.school?.schoolId ? `(${detail.school.schoolId})` : ''}
              </DialogTitle>
            </DialogHeader>
            {detail && (
              <div className="flex gap-2">
                <button
                  onClick={() => buildSchoolPDF(detail)}
                  className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={() => buildSchoolExcel(detail)}
                  className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </button>
              </div>
            )}
          </div>

          {detailLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#004f9f]" />
            </div>
          ) : !detail ? (
            <div className="py-16 text-center text-gray-500 text-sm">Failed to load report.</div>
          ) : (
            <div className="p-6 bg-white space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm bg-gray-50 border border-gray-200 p-4">
                <InfoRow label="School Name" value={detail.school.name} />
                <InfoRow label="School ID" value={detail.school.schoolId} mono />
                <InfoRow label="CRM ID" value={detail.school.olympiadId} mono />
                <InfoRow label="Location" value={[detail.school.city, detail.school.district, detail.school.state].filter(Boolean).join(', ')} />
                <InfoRow label="Contact" value={detail.school.contactPerson} />
                <InfoRow label="Exam Date" value={fmtDate(detail.school.examDate)} />
                <InfoRow
                  label="Submitted On"
                  value={detail.school.attendanceSubmittedAt ? fmtDateTime(detail.school.attendanceSubmittedAt) : 'Not yet submitted'}
                />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <SummaryTile label="Total" value={detail.summary.total} />
                <SummaryTile label="Present" value={detail.summary.present} color="text-green-700" />
                <SummaryTile label="Absent" value={detail.summary.absent} color="text-red-700" />
                <SummaryTile label="Unmarked" value={detail.summary.unmarked} color="text-gray-500" />
              </div>

              <div className="border border-gray-300 overflow-hidden">
                <div className="max-h-96 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#E8EAF6] sticky top-0">
                      <tr className="border-b-2 border-[#06013E] text-[#004f9f]">
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300 w-12">#</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Olympiad ID</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Student Name</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Class</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase border-r border-gray-300">Phone</th>
                        <th className="px-3 py-2 text-left text-xs font-bold uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.students.map((s, idx) => (
                        <tr key={s.olympiadCode} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-3 py-2 border-r border-gray-200 text-gray-700 text-xs">{idx + 1}</td>
                          <td className="px-3 py-2 border-r border-gray-200 font-mono font-semibold text-[#004f9f]">{s.olympiadCode}</td>
                          <td className="px-3 py-2 border-r border-gray-200 text-gray-900">{s.name}</td>
                          <td className="px-3 py-2 border-r border-gray-200 text-gray-700 text-xs">{s.className || '—'}</td>
                          <td className="px-3 py-2 border-r border-gray-200 font-mono text-gray-700 text-xs">{s.phone}</td>
                          <td className="px-3 py-2">
                            {s.status === 'PRESENT' ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-green-100 text-green-800 border border-green-300">Present</span>
                            ) : s.status === 'ABSENT' ? (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-300">Absent</span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-gray-100 text-gray-600 border border-gray-300">Unmarked</span>
                            )}
                          </td>
                        </tr>
                      ))}
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

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide w-32 shrink-0">{label}</span>
      <span className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''} break-words`}>{value || '-'}</span>
    </div>
  );
}

function SummaryTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="border border-gray-200 bg-gray-50 p-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
