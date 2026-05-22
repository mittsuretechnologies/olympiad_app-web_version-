'use client';

import { useState } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertCircle } from 'lucide-react';

export default function BulkUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    // TODO: API call to upload Excel
    setTimeout(() => {
      setUploading(false);
      setResult({ success: true, message: 'Successfully uploaded 25 schools from the Excel file.' });
      setFile(null);
    }, 2000);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#432818]">Bulk School Registration</h1>
        <p className="text-sm text-[#432818]/60 mt-1">Upload an Excel file to register multiple schools at once. School Name, CRM ID, State, and District are required columns.</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Download Template */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#FF9000]/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[#432818]">Download Template</h3>
              <p className="text-sm text-[#432818]/50 mt-1">Use our Excel template to ensure correct formatting</p>
            </div>
            <button className="flex items-center gap-2 bg-[#FF9000]/10 text-[#FF9000] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#FF9000]/20 transition-all">
              <Download size={16} />
              Download .xlsx
            </button>
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#FF9000]/10 p-6">
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              dragActive
                ? 'border-[#FF9000] bg-[#FF9000]/5'
                : 'border-gray-200 hover:border-[#FF9000]/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Upload size={40} className="mx-auto text-[#FF9000]/40 mb-4" />
            <p className="font-semibold text-[#432818]">
              {file ? file.name : 'Drag & drop your Excel file here'}
            </p>
            <p className="text-sm text-[#432818]/50 mt-1">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'or click to browse (.xlsx, .xls, .csv)'}
            </p>
          </div>

          {file && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={20} className="text-green-600" />
                <span className="text-sm font-medium text-[#432818]">{file.name}</span>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="bg-[#FF9000] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-[#e68200] transition-all shadow-md disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload & Register'}
              </button>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <AlertCircle size={20} className="text-red-600" />
            )}
            <span className={`text-sm font-medium ${result.success ? 'text-green-700' : 'text-red-700'}`}>
              {result.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
