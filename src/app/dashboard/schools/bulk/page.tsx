'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle, X, Copy } from 'lucide-react';
import * as XLSX from 'xlsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string;
  olympiadId: string;
  state: string;
  district: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  pincode?: string;
  classes: string; // raw string like "Class 1:30,Class 2:25"
  _rowIndex: number;
  _errors: string[];
}

interface CreatedSchool {
  schoolId: string;
  name: string;
  username: string;
  password: string;
  olympiadIdsGenerated?: number;
  firstCode?: string;
  lastCode?: string;
}

interface UploadResult {
  created: CreatedSchool[];
  errors: { name: string; reason: string }[];
  message: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_CLASSES = ['PG', 'Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8'];

const REQUIRED_COLS = ['School Name', 'CRM ID', 'State', 'District'];
const OPTIONAL_COLS = ['City', 'Address', 'Contact Person', 'Phone', 'Email', 'Pincode', 'Classes'];

// ─── Template download ────────────────────────────────────────────────────────

function downloadTemplate() {
  const headers = [...REQUIRED_COLS, ...OPTIONAL_COLS];
  const sample = [
    'Sunrise Public School',
    'OLY2026001',
    'Maharashtra',
    'Pune',
    'Pune City',
    '123 MG Road, Shivajinagar',
    'Ramesh Kumar',
    '9876543210',
    'sunrise@school.com',
    '411001',
    'Class 1:30,Class 2:25,Class 3:20',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));

  // Style header row bold + green background (limited xlsx support)
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Schools');
  XLSX.writeFile(wb, 'bulk_school_template.xlsx');
}

// ─── Parse Excel ─────────────────────────────────────────────────────────────

function parseExcel(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rows.length < 2) {
          reject(new Error('File is empty or has no data rows'));
          return;
        }

        const headerRow = rows[0].map((h: any) => String(h).trim());
        const col = (name: string) => headerRow.indexOf(name);

        const missing = REQUIRED_COLS.filter((c) => col(c) === -1);
        if (missing.length) {
          reject(new Error(`Missing required columns: ${missing.join(', ')}`));
          return;
        }

        const parsed: ParsedRow[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          const get = (name: string) => String(r[col(name)] ?? '').trim();

          const name = get('School Name');
          const olympiadId = get('CRM ID');
          const state = get('State');
          const district = get('District');

          if (!name && !olympiadId && !state && !district) continue; // blank row

          const errs: string[] = [];
          if (!name) errs.push('School Name missing');
          if (!olympiadId) errs.push('CRM ID missing');
          if (!state) errs.push('State missing');
          if (!district) errs.push('District missing');

          parsed.push({
            name,
            olympiadId,
            state,
            district,
            city: get('City') || undefined,
            address: get('Address') || undefined,
            contactPerson: get('Contact Person') || undefined,
            phone: get('Phone') || undefined,
            email: get('Email') || undefined,
            pincode: get('Pincode') || undefined,
            classes: col('Classes') !== -1 ? get('Classes') : '',
            _rowIndex: i + 1,
            _errors: errs,
          });
        }

        resolve(parsed);
      } catch (err: any) {
        reject(new Error(err.message || 'Failed to parse file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// Normalize "Class PG" → "PG", "Class LKG" → "LKG", "Class UKG" → "UKG", "Class Nursery" → "Nursery"
function normalizeClassName(raw: string): string {
  const s = raw.trim();
  // Strip "Class " prefix for non-numeric classes (PG, Nursery, LKG, UKG)
  const stripped = s.replace(/^Class\s+/i, '');
  if (['PG', 'Nursery', 'LKG', 'UKG'].includes(stripped)) return stripped;
  return s; // keep as-is for "Class 1", "Class 2" etc.
}

// Parse "Class 1:30,Class 2:25,PG:15" → [{ className, count }]
function parseClasses(raw: string): { className: string; count: number }[] | null {
  if (!raw.trim()) return null;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const result: { className: string; count: number }[] = [];
  for (const part of parts) {
    const sep = part.lastIndexOf(':');
    if (sep === -1) return null;
    const className = normalizeClassName(part.slice(0, sep));
    const count = parseInt(part.slice(sep + 1).trim(), 10);
    if (!VALID_CLASSES.includes(className) || isNaN(count) || count < 1) return null;
    result.push({ className, count });
  }
  return result.length ? result : null;
}

// ─── Download results as Excel ────────────────────────────────────────────────

function downloadResults(created: CreatedSchool[]) {
  const headers = ['School Name', 'School ID (Username)', 'Password', 'Olympiad IDs Generated', 'First Code', 'Last Code'];
  const rows = created.map((s) => [
    s.name,
    s.username,
    s.password,
    s.olympiadIdsGenerated ?? '',
    s.firstCode ?? '',
    s.lastCode ?? '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Created Schools');
  XLSX.writeFile(wb, 'created_schools_credentials.xlsx');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) selectFile(f);
  };

  const selectFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setParseError(null);
    setParsed(null);
    try {
      const rows = await parseExcel(f);
      setParsed(rows);
    } catch (err: any) {
      setParseError(err.message);
    }
  };

  const clearFile = () => {
    setFile(null);
    setParsed(null);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = parsed?.filter((r) => r._errors.length === 0) ?? [];
  const invalidRows = parsed?.filter((r) => r._errors.length > 0) ?? [];

  const handleUpload = async () => {
    if (!validRows.length) return;
    setUploading(true);
    setResult(null);

    const schools = validRows.map((r) => {
      const classesPayload = parseClasses(r.classes);
      return {
        name: r.name,
        olympiadId: r.olympiadId,
        state: r.state,
        district: r.district,
        city: r.city,
        address: r.address,
        contactPerson: r.contactPerson,
        phone: r.phone,
        email: r.email,
        pincode: r.pincode,
        ...(classesPayload ? { classes: classesPayload } : {}),
      };
    });

    // Call individual POST /api/schools for each (reuses existing logic + olympiad ID gen)
    const created: CreatedSchool[] = [];
    const errors: { name: string; reason: string }[] = [];

    for (const school of schools) {
      try {
        const res = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(school),
        });
        const data = await res.json();
        if (!res.ok) {
          errors.push({ name: school.name, reason: data.message || 'Failed' });
        } else {
          created.push({
            schoolId: data.schoolId,
            name: data.name,
            username: data.credentials?.username ?? data.schoolId,
            password: data.credentials?.password ?? '',
            olympiadIdsGenerated: data.olympiadIdsGenerated,
            firstCode: data.firstCode,
            lastCode: data.lastCode,
          });
        }
      } catch {
        errors.push({ name: school.name, reason: 'Network error' });
      }
    }

    setResult({
      created,
      errors,
      message: `${created.length} school(s) registered${errors.length ? `, ${errors.length} failed` : ''}.`,
    });
    setUploading(false);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const labelCls = 'block text-xs font-bold text-black mb-1 uppercase tracking-wide';

  return (
    <div className="bg-[#FFFEFE] border border-gray-300 shadow-sm max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-[#009846] text-white px-6 py-3 border-b-4 border-[#FF9000]">
        <h1 className="text-base font-bold uppercase tracking-wider">Bulk School Registration</h1>
      </div>

      <div className="p-5 space-y-5">

        {/* Step 1: Download Template */}
        <div className="border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-black">Step 1 — Download Template</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Fill in: <span className="font-semibold text-[#009846]">School Name, CRM ID, State, District</span> (required) +
              City, Address, Contact Person, Phone, Email, Pincode, Classes (optional)
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Classes format: <span className="font-mono bg-gray-100 px-1">Class 1:30,Class 2:25,PG:15</span>
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-[#009846] text-white px-4 py-2 text-sm font-semibold hover:bg-[#007a38] transition-colors shrink-0 ml-4"
          >
            <Download size={15} />
            Download .xlsx
          </button>
        </div>

        {/* Step 2: Upload */}
        <div>
          <p className={`${labelCls} mb-2`}>Step 2 — Upload Filled Excel</p>
          {!file ? (
            <div
              className={`border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                dragActive ? 'border-[#009846] bg-[#009846]/5' : 'border-gray-300 hover:border-[#009846]/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-[#432818] text-sm">Drag & drop your Excel file here</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse (.xlsx, .xls, .csv)</p>
            </div>
          ) : (
            <div className="border border-gray-300 p-3 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} className="text-green-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[#432818]">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button onClick={clearFile} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) selectFile(e.target.files[0]); }}
          />
        </div>

        {/* Parse error */}
        {parseError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            {parseError}
          </div>
        )}

        {/* Preview Table */}
        {parsed && parsed.length > 0 && !result && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={labelCls}>
                Step 3 — Preview ({validRows.length} valid
                {invalidRows.length > 0 && <span className="text-red-600">, {invalidRows.length} with errors</span>})
              </p>
              {validRows.length > 0 && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-[#009846] text-white px-5 py-2 text-sm font-semibold hover:bg-[#007a38] disabled:opacity-50 transition-colors"
                >
                  {uploading
                    ? `Registering… (0/${validRows.length})`
                    : `Register ${validRows.length} School${validRows.length > 1 ? 's' : ''}`}
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-100 text-black uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-bold border-r border-gray-200">#</th>
                    <th className="text-left px-3 py-2 font-bold border-r border-gray-200">School Name</th>
                    <th className="text-left px-3 py-2 font-bold border-r border-gray-200">CRM ID</th>
                    <th className="text-left px-3 py-2 font-bold border-r border-gray-200">State</th>
                    <th className="text-left px-3 py-2 font-bold border-r border-gray-200">District</th>
                    <th className="text-left px-3 py-2 font-bold border-r border-gray-200">Classes</th>
                    <th className="text-left px-3 py-2 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((row) => (
                    <tr
                      key={row._rowIndex}
                      className={`border-t border-gray-100 ${row._errors.length ? 'bg-red-50' : 'bg-white hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2 text-gray-400 border-r border-gray-100">{row._rowIndex}</td>
                      <td className="px-3 py-2 font-medium text-[#432818] border-r border-gray-100 max-w-[180px] truncate">{row.name || '—'}</td>
                      <td className="px-3 py-2 font-mono text-[#009846] border-r border-gray-100">{row.olympiadId || '—'}</td>
                      <td className="px-3 py-2 border-r border-gray-100">{row.state || '—'}</td>
                      <td className="px-3 py-2 border-r border-gray-100">{row.district || '—'}</td>
                      <td className="px-3 py-2 border-r border-gray-100 text-gray-500 max-w-[160px] truncate">
                        {row.classes || <span className="text-gray-300 italic">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {row._errors.length === 0 ? (
                          <span className="text-green-600 font-semibold">✓ OK</span>
                        ) : (
                          <span className="text-red-600" title={row._errors.join(', ')}>
                            ✗ {row._errors[0]}{row._errors.length > 1 ? ` +${row._errors.length - 1}` : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidRows.length > 0 && (
              <p className="text-xs text-red-600 mt-2">
                ⚠ {invalidRows.length} row(s) with errors will be skipped. Fix them in the Excel and re-upload.
              </p>
            )}
          </div>
        )}

        {/* Uploading progress indicator */}
        {uploading && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
            Registering schools and generating Olympiad IDs, please wait…
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className={`flex items-center gap-3 px-4 py-3 border text-sm font-semibold ${
              result.errors.length === 0
                ? 'bg-green-50 border-green-200 text-green-800'
                : result.created.length === 0
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-yellow-50 border-yellow-200 text-yellow-800'
            }`}>
              {result.errors.length === 0 ? (
                <CheckCircle size={18} className="shrink-0 text-green-600" />
              ) : (
                <AlertCircle size={18} className="shrink-0 text-yellow-600" />
              )}
              {result.message}
              {result.created.length > 0 && (
                <button
                  onClick={() => downloadResults(result.created)}
                  className="ml-auto flex items-center gap-1.5 bg-[#009846] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#007a38] transition-colors"
                >
                  <Download size={13} />
                  Download Credentials
                </button>
              )}
            </div>

            {/* Created schools table */}
            {result.created.length > 0 && (
              <div>
                <p className={`${labelCls} mb-2`}>Created Schools & Credentials</p>
                <div className="overflow-x-auto border border-gray-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#009846] text-white uppercase tracking-wide">
                        <th className="text-left px-3 py-2 font-bold border-r border-green-700">#</th>
                        <th className="text-left px-3 py-2 font-bold border-r border-green-700">School Name</th>
                        <th className="text-left px-3 py-2 font-bold border-r border-green-700">Username</th>
                        <th className="text-left px-3 py-2 font-bold border-r border-green-700">Password</th>
                        <th className="text-left px-3 py-2 font-bold border-r border-green-700">IDs Generated</th>
                        <th className="text-left px-3 py-2 font-bold border-r border-green-700">First Code</th>
                        <th className="text-left px-3 py-2 font-bold">Last Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.created.map((s, i) => (
                        <tr key={s.schoolId} className="border-t border-gray-100 bg-white hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400 border-r border-gray-100">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-[#432818] border-r border-gray-100 max-w-[180px] truncate">{s.name}</td>
                          <td className="px-3 py-2 border-r border-gray-100">
                            <span className="font-mono text-[#009846] font-semibold">{s.username}</span>
                          </td>
                          <td className="px-3 py-2 border-r border-gray-100">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[#432818]">{s.password}</span>
                              <button
                                onClick={() => copyText(s.password, s.schoolId)}
                                className="text-gray-400 hover:text-[#009846] transition-colors"
                                title="Copy password"
                              >
                                {copiedId === s.schoolId
                                  ? <CheckCircle size={13} className="text-green-500" />
                                  : <Copy size={13} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center border-r border-gray-100 font-semibold text-[#009846]">
                            {s.olympiadIdsGenerated ?? '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{s.firstCode ?? '—'}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{s.lastCode ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Failed rows */}
            {result.errors.length > 0 && (
              <div>
                <p className={`${labelCls} mb-2 text-red-600`}>Failed ({result.errors.length})</p>
                <div className="border border-red-200 bg-red-50 divide-y divide-red-100">
                  {result.errors.map((e, i) => (
                    <div key={i} className="px-4 py-2 flex items-start gap-2 text-xs">
                      <AlertCircle size={13} className="text-red-500 shrink-0 mt-0.5" />
                      <span className="font-semibold text-red-700">{e.name}</span>
                      <span className="text-red-500">— {e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload another */}
            <button
              onClick={clearFile}
              className="text-xs text-gray-500 underline hover:text-[#009846] transition-colors"
            >
              Upload another file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
