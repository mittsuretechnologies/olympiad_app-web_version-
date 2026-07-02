'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/swr';
import {
  Play, CheckCircle, XCircle, Clock, School,
  Eye, Globe, Lock, Award, RefreshCw, Trash2,
  Search, Filter, ChevronDown, X,
} from 'lucide-react';
import { OLYMPIAD_CAT_A_SUBS, OLYMPIAD_CAT_B_SUBS, OLYMPIAD_CAT_A_LABEL, OLYMPIAD_CAT_B_LABEL } from '@/lib/olympiad-categories';

// Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ Types Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬

interface Video {
  id: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  category: string;
  subCategory: string;
  tags: string;
  isPublic: boolean;
  isEvaluation: boolean;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  uploaderType: string | null;
  appUser: { userId: string; email: string | null; mobile: string | null; olympiadId: string | null; school: { name: string; city: string; district: string; state: string } | null } | null;
  student: {
    name: string;
    olympiadCode: string;
    allocation: {
      school: { name: string; city: string; district: string; state: string };
    };
  } | null;
}

interface ApiResponse {
  videos: Video[];
  counts: { PENDING: number; APPROVED: number; REJECTED: number };
}

type StatusFilter = 'PENDING' | 'APPROVED' | 'REJECTED';

// Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ Constants Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬

const REJECTION_TEMPLATES = [
  'Video quality is too low.',
  'Content is not relevant to the category.',
  'Background noise / audio issue.',
  'Student not clearly visible in the video.',
  'Video duration is too short.',
  'Inappropriate content detected.',
  'Wrong category submitted.',
];

const ALL_SUBCATEGORIES = [...OLYMPIAD_CAT_A_SUBS, ...OLYMPIAD_CAT_B_SUBS];

const TAB_CFG = {
  PENDING:  { label: 'Pending',  activeClass: 'bg-amber-500 text-white shadow-sm',  dot: 'bg-amber-400' },
  APPROVED: { label: 'Approved', activeClass: 'bg-green-600 text-white shadow-sm',  dot: 'bg-green-500' },
  REJECTED: { label: 'Rejected', activeClass: 'bg-red-600   text-white shadow-sm',  dot: 'bg-red-400'   },
};

// Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ Helper Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCategoryLabel(cat: string) {
  if (OLYMPIAD_CAT_A_SUBS.includes(cat)) return { label: 'Talent Performance', color: 'bg-violet-50 text-violet-700 border-violet-200' };
  if (OLYMPIAD_CAT_B_SUBS.includes(cat)) return { label: 'Rhymes / Speech', color: 'bg-teal-50 text-teal-700 border-teal-200' };
  return null;
}

// Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ Component Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬

export default function VideoModerationPage() {
  // Ã¢ââ¬Ã¢ââ¬ Tab & Filters Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const [filter,       setFilter]       = useState<StatusFilter>('PENDING');
  const [search,       setSearch]       = useState('');
  const [catFilter,    setCatFilter]    = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [filterOpen,   setFilterOpen]   = useState(false);

  // Ã¢ââ¬Ã¢ââ¬ Selection Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const [selected,     setSelected]     = useState<Set<string>>(new Set());

  // Ã¢ââ¬Ã¢ââ¬ Modals Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [rejectModal,  setRejectModal]  = useState<{ video: Video | null; bulk: boolean }>({ video: null, bulk: false });
  const [rejectReason, setRejectReason] = useState('');
  const [deleteModal,  setDeleteModal]  = useState<{ ids: string[] } | null>(null);

  // Ã¢ââ¬Ã¢ââ¬ Processing Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkWorking,  setBulkWorking]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  // Ã¢ââ¬Ã¢ââ¬ SWR Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const params = new URLSearchParams();
  params.set('status', filter);
  if (catFilter) params.set('category', catFilter);
  if (typeFilter) params.set('uploaderType', typeFilter);
  const swrKey = `/api/dashboard/videos?${params.toString()}`;
  const { data, isLoading: loading, mutate } = useSWR<ApiResponse>(swrKey, fetcher);

  const counts = data?.counts ?? { PENDING: 0, APPROVED: 0, REJECTED: 0 };

  // Ã¢ââ¬Ã¢ââ¬ Client-side search Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const videos = useMemo(() => {
    const allVideos: Video[] = Array.isArray(data?.videos) ? data!.videos : [];
    if (!search.trim()) return allVideos;
    const q = search.toLowerCase();
    return allVideos.filter(v =>
      v.caption?.toLowerCase().includes(q) ||
      v.student?.name?.toLowerCase().includes(q) ||
      v.student?.olympiadCode?.toLowerCase().includes(q) ||
      v.student?.allocation?.school?.name?.toLowerCase().includes(q) ||
      v.appUser?.userId?.toLowerCase().includes(q) ||
      v.appUser?.olympiadId?.toLowerCase().includes(q) ||
      v.appUser?.school?.name?.toLowerCase().includes(q) ||
      v.subCategory?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const fetchVideos = () => { mutate(); setSelected(new Set()); };

  // Ã¢ââ¬Ã¢ââ¬ Selection helpers Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const allSelected  = videos.length > 0 && videos.every(v => selected.has(v.id));
  const someSelected = videos.some(v => selected.has(v.id));
  const selectedIds  = [...selected].filter(id => videos.some(v => v.id === id));

  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(videos.map(v => v.id)));

  // Ã¢ââ¬Ã¢ââ¬ Single approve / reject Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const approve = async (video: Video) => {
    setProcessingId(video.id);
    try {
      const res = await fetch('/api/dashboard/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id, status: 'APPROVED' }),
      });
      if (res.ok) {
        mutate(cur => cur ? { ...cur, videos: cur.videos.filter(v => v.id !== video.id) } : cur, { revalidate: false });
        setSelected(prev => { const n = new Set(prev); n.delete(video.id); return n; });
        if (previewVideo?.id === video.id) setPreviewVideo(null);
      } else alert('Failed to approve');
    } finally { setProcessingId(null); }
  };

  const openRejectModal = (video: Video) => {
    setRejectReason('');
    setRejectModal({ video, bulk: false });
  };

  const openBulkRejectModal = () => {
    setRejectReason('');
    setRejectModal({ video: null, bulk: true });
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) { alert('Please enter a rejection reason.'); return; }

    if (rejectModal.bulk) {
      // Bulk reject
      setRejectModal({ video: null, bulk: false });
      setBulkWorking(true);
      try {
        const res = await fetch('/api/dashboard/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoIds: selectedIds, status: 'REJECTED', rejectionReason: rejectReason.trim() }),
        });
        if (res.ok) {
          const deleted = new Set(selectedIds);
          mutate(cur => cur ? { ...cur, videos: cur.videos.filter(v => !deleted.has(v.id)) } : cur, { revalidate: false });
          setSelected(new Set());
        } else alert('Failed to bulk reject');
      } finally { setBulkWorking(false); }
    } else {
      // Single reject
      const video = rejectModal.video!;
      setRejectModal({ video: null, bulk: false });
      setProcessingId(video.id);
      try {
        const res = await fetch('/api/dashboard/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: video.id, status: 'REJECTED', rejectionReason: rejectReason.trim() }),
        });
        if (res.ok) {
          mutate(cur => cur ? { ...cur, videos: cur.videos.filter(v => v.id !== video.id) } : cur, { revalidate: false });
          setSelected(prev => { const n = new Set(prev); n.delete(video.id); return n; });
          if (previewVideo?.id === video.id) setPreviewVideo(null);
        } else alert('Failed to reject');
      } finally { setProcessingId(null); }
    }
  };

  // Ã¢ââ¬Ã¢ââ¬ Bulk approve Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const bulkApprove = async () => {
    if (!selectedIds.length) return;
    setBulkWorking(true);
    try {
      const res = await fetch('/api/dashboard/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: selectedIds, status: 'APPROVED' }),
      });
      if (res.ok) {
        const approved = new Set(selectedIds);
        mutate(cur => cur ? { ...cur, videos: cur.videos.filter(v => !approved.has(v.id)) } : cur, { revalidate: false });
        setSelected(new Set());
      } else alert('Failed to bulk approve');
    } finally { setBulkWorking(false); }
  };

  // Ã¢ââ¬Ã¢ââ¬ Delete Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  const openDeleteModal = (ids: string[]) => setDeleteModal({ ids });

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/dashboard/videos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: deleteModal.ids }),
      });
      if (res.ok) {
        const deleted = new Set(deleteModal.ids);
        mutate(cur => cur ? { ...cur, videos: cur.videos.filter(v => !deleted.has(v.id)) } : cur, { revalidate: false });
        setSelected(prev => { const n = new Set(prev); deleted.forEach(id => n.delete(id)); return n; });
        if (previewVideo && deleted.has(previewVideo.id)) setPreviewVideo(null);
      } else alert('Failed to delete video(s).');
    } finally { setDeleting(false); setDeleteModal(null); }
  };

  const activeFilters = [catFilter, typeFilter].filter(Boolean).length;

  // Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬
  return (
    <div className="space-y-4">

      {/* Ã¢ââ¬Ã¢ââ¬ Header Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-medium text-[#004f9f]">Video Moderation</h1>
        </div>
        <button
          onClick={fetchVideos}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors shadow-sm"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Ã¢ââ¬Ã¢ââ¬ Stats bar Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.keys(TAB_CFG) as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setSelected(new Set()); }}
            className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
              filter === s
                ? s === 'PENDING'  ? 'border-amber-300 bg-amber-50'
                : s === 'APPROVED' ? 'border-green-300 bg-green-50'
                                   : 'border-red-300 bg-red-50'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{TAB_CFG[s].label}</p>
              <p className={`text-2xl font-black mt-0.5 ${
                s === 'PENDING'  ? 'text-amber-600'
                : s === 'APPROVED' ? 'text-green-700'
                                   : 'text-red-600'
              }`}>{counts[s]}</p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              s === 'PENDING'  ? 'bg-amber-100'
              : s === 'APPROVED' ? 'bg-green-100'
                                 : 'bg-red-100'
            }`}>
              {s === 'PENDING'  && <Clock       size={18} className="text-amber-500" />}
              {s === 'APPROVED' && <CheckCircle size={18} className="text-green-600" />}
              {s === 'REJECTED' && <XCircle     size={18} className="text-red-500"   />}
            </div>
          </button>
        ))}
      </div>

      {/* Ã¢ââ¬Ã¢ââ¬ Search + Filter bar Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      <div className="flex gap-2">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, school, olympiad code, captionâ¦"
            className="w-full pl-9 pr-4 h-9 border border-gray-200 rounded-xl text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#014584]/20 focus:border-[#014584]/40 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter button */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className={`flex items-center gap-2 h-9 px-3.5 rounded-xl border text-xs font-bold transition-colors ${
              activeFilters ? 'border-[#014584] bg-[#014584]/5 text-[#014584]' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Filter size={13} />
            Filters
            {activeFilters > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#014584] text-white text-[10px] font-black flex items-center justify-center">
                {activeFilters}
              </span>
            )}
            <ChevronDown size={12} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-11 z-20 bg-white border border-gray-200 rounded-2xl shadow-lg p-4 w-64 space-y-3">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Category</p>
                <select
                  value={catFilter}
                  onChange={e => { setCatFilter(e.target.value); setFilterOpen(false); }}
                  className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#014584]/30"
                >
                  <option value="">All categories</option>
                  <optgroup label={OLYMPIAD_CAT_A_LABEL}>
                    {OLYMPIAD_CAT_A_SUBS.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                  <optgroup label={OLYMPIAD_CAT_B_LABEL}>
                    {OLYMPIAD_CAT_B_SUBS.map(s => <option key={s} value={s}>{s}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Uploader Type</p>
                <div className="flex gap-2">
                  {['', 'STUDENT', 'VIEWER'].map(t => (
                    <button
                      key={t}
                      onClick={() => { setTypeFilter(t); setFilterOpen(false); }}
                      className={`flex-1 h-7 rounded-lg text-[11px] font-bold border transition-colors ${
                        typeFilter === t ? 'bg-[#014584] text-white border-[#014584]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {t || 'All'}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilters > 0 && (
                <button
                  onClick={() => { setCatFilter(''); setTypeFilter(''); setFilterOpen(false); }}
                  className="w-full h-7 text-[11px] font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ã¢ââ¬Ã¢ââ¬ Bulk action bar Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      {someSelected && (
        <div className="flex items-center justify-between bg-[#014584]/5 border border-[#014584]/20 rounded-2xl px-4 py-2.5">
          <span className="text-xs font-black text-[#014584]">
            {selectedIds.length} video{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 text-[11px] font-bold text-gray-500 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors"
            >
              Deselect
            </button>
            {filter === 'PENDING' && (
              <>
                <button
                  onClick={bulkApprove}
                  disabled={bulkWorking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {bulkWorking ? <Clock size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                  Approve {selectedIds.length}
                </button>
                <button
                  onClick={openBulkRejectModal}
                  disabled={bulkWorking}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50"
                >
                  <XCircle size={11} /> Reject {selectedIds.length}
                </button>
              </>
            )}
            <button
              onClick={() => openDeleteModal(selectedIds)}
              disabled={bulkWorking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black text-white bg-red-700 hover:bg-red-800 rounded-xl transition-colors disabled:opacity-50"
            >
              <Trash2 size={11} /> Delete {selectedIds.length}
            </button>
          </div>
        </div>
      )}

      {/* Ã¢ââ¬Ã¢ââ¬ Content Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3">
          <Clock size={26} className="animate-spin text-gray-300" />
          <span className="text-gray-400 text-sm font-bold">Loadingâ¦</span>
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white border border-dashed border-gray-200 rounded-2xl">
          <Play size={40} className="text-gray-200 mb-3" />
          <p className="text-gray-400 font-bold text-sm">No {filter.toLowerCase()} videos found</p>
          {(search || activeFilters > 0) && (
            <button
              onClick={() => { setSearch(''); setCatFilter(''); setTypeFilter(''); }}
              className="mt-2 text-xs text-[#014584] underline"
            >
              Clear search & filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Select-all bar */}
          <div className="flex items-center gap-2 px-1">
            <input type="checkbox" checked={allSelected} onChange={toggleAll}
              className="w-3.5 h-3.5 rounded accent-[#014584] cursor-pointer" />
            <span className="text-[11px] text-gray-400 font-semibold">
              {allSelected ? 'Deselect all' : `Select all ${videos.length}`}
            </span>
            <span className="text-[11px] text-gray-300 ml-1">{videos.length} video{videos.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Card grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {videos.map((video) => {
              const school    = video.student?.allocation?.school;
              const busy      = processingId === video.id;
              const tagList   = video.tags ? video.tags.split(',').filter(Boolean) : [];
              const isChecked = selected.has(video.id);
              const catBadge  = getCategoryLabel(video.subCategory);
              const isStudent = video.uploaderType === 'STUDENT' || !!video.student;

              return (
                <div
                  key={video.id}
                  className={`group relative bg-[#F0F4FF] rounded-2xl border overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                    isChecked ? 'border-[#014584] ring-2 ring-[#014584]/20' : 'border-[#C7D8FF]'
                  }`}
                >
                  {/* Thumbnail */}
                  <div
                    className="relative w-full aspect-video bg-black cursor-pointer overflow-hidden"
                    onClick={() => setPreviewVideo(video)}
                  >
                    {video.thumbnailUrl ? (
                      <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={video.videoUrl} className="w-full h-full object-cover" preload="metadata" muted />
                    )}
                    {/* Dark overlay on hover */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play size={18} className="text-white fill-current ml-0.5" />
                      </div>
                    </div>

                    {/* Top-left: checkbox */}
                    <div className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(video.id)}
                        className="w-4 h-4 rounded accent-[#014584] cursor-pointer shadow" />
                    </div>

                    {/* Top-right: jury badge */}
                    {video.isEvaluation && (
                      <div className="absolute top-2 right-2">
                        <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-700 bg-amber-400 px-2 py-0.5 rounded-full shadow">
                          <Award size={9} /> Jury
                        </span>
                      </div>
                    )}

                    {/* Bottom gradient + date */}
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/60 to-transparent flex items-end px-2.5 pb-1.5">
                      <span className="text-[10px] text-white/70 font-medium">{formatDate(video.createdAt)}</span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-3 space-y-2 bg-[#F0F4FF]">

                    {/* Badges row */}
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-black text-[#014584] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                        {video.subCategory || video.category}
                      </span>
                      {catBadge && (
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${catBadge.color}`}>
                          {catBadge.label}
                        </span>
                      )}
                      <span className={`flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full border ml-auto ${video.isPublic ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-purple-600 bg-purple-50 border-purple-100'}`}>
                        {video.isPublic ? <Globe size={8} /> : <Lock size={8} />}
                        {video.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>

                    {/* Caption + Tags row */}
                    <div className="flex items-start gap-2 min-w-0">
                      {video.caption && (
                        <span className="flex-1 min-w-0 text-[11px] font-semibold text-gray-700 bg-gray-100 rounded-lg px-2 py-1 truncate">
                          {video.caption}
                        </span>
                      )}
                      {tagList.length > 0 && (
                        <span className="shrink-0 text-[10px] text-indigo-400 bg-indigo-50 border border-indigo-100 px-1.5 py-1 rounded-lg font-semibold">
                          #{tagList[0]}{tagList.length > 1 ? ` +${tagList.length - 1}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Rejection reason */}
                    {video.status === 'REJECTED' && video.rejectionReason && (
                      <p className="text-[10px] text-red-400 bg-red-50 rounded-lg px-2 py-1 truncate">
                        Ã¢Åâ¢ {video.rejectionReason}
                      </p>
                    )}

                    {/* Divider */}
                    <div className="border-t border-gray-100 pt-2">
                      {/* Student / viewer info */}
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                          isStudent ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {video.student?.name?.[0] ?? video.appUser?.userId?.[0] ?? '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black text-[#004f9f] truncate">
                            {video.student?.name ?? video.appUser?.userId ?? 'â'}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono truncate">
                            {video.student?.olympiadCode ?? video.appUser?.email ?? video.appUser?.mobile ?? ''}
                          </p>
                        </div>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                          isStudent ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'
                        }`}>
                          {isStudent ? '🎓' : '📱'}
                        </span>
                      </div>

                      {/* School */}
                      {school && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <School size={9} className="text-gray-300 shrink-0" />
                          <p className="text-[10px] text-gray-400 truncate">{school.name}</p>
                          {(school.district || school.state) && (
                            <span className="text-[9px] text-gray-300 shrink-0">Â· {school.district || school.state}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className={`flex gap-1.5 pt-1 ${filter === 'PENDING' ? '' : 'justify-between'}`}>
                      {filter === 'PENDING' ? (
                        <>
                          <button onClick={() => approve(video)} disabled={busy}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[11px] font-black transition-colors disabled:opacity-40">
                            {busy ? <Clock size={11} className="animate-spin" /> : <CheckCircle size={11} />} Approve
                          </button>
                          <button onClick={() => openRejectModal(video)} disabled={busy}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[11px] font-black transition-colors disabled:opacity-40">
                            <XCircle size={11} /> Reject
                          </button>
                          <button onClick={() => setPreviewVideo(video)} disabled={busy}
                            className="px-2.5 py-2 rounded-xl border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40">
                            <Eye size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setPreviewVideo(video)} disabled={busy}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-[11px] font-bold transition-colors disabled:opacity-40">
                            <Eye size={12} /> Preview
                          </button>
                          <button onClick={() => openDeleteModal([video.id])} disabled={busy}
                            className="px-3 py-2 rounded-xl border border-red-200 text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Ã¢ââ¬Ã¢ââ¬ Preview modal Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      {previewVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewVideo(null)}>
          <div className="bg-[#0f0f0f] rounded-2xl overflow-hidden w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-black flex items-center justify-center relative" style={{ maxHeight: 340 }}>
              <video src={previewVideo.videoUrl} controls autoPlay className="w-full max-h-[340px] object-contain" />
              <button onClick={() => setPreviewVideo(null)}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center transition-colors">
                <X size={14} className="text-white" />
              </button>
            </div>

            <div className="p-4 space-y-3">

              {/* Category + date row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-black text-blue-300 bg-white/10 px-2.5 py-1 rounded-full">
                    {previewVideo.subCategory || previewVideo.category}
                  </span>
                  {(() => { const b = getCategoryLabel(previewVideo.subCategory); return b ? (
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-white/10 text-white/70">{b.label}</span>
                  ) : null; })()}
                  {previewVideo.isEvaluation && (
                    <span className="flex items-center gap-1 text-[10px] font-black bg-amber-400 text-amber-900 px-2 py-1 rounded-full">
                      <Award size={10} /> Jury
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-white/30">{formatDate(previewVideo.createdAt)}</span>
              </div>

              {/* Caption */}
              {previewVideo.caption && (
                <p className="text-sm font-semibold text-white bg-white/10 rounded-xl px-3 py-2">
                  {previewVideo.caption}
                </p>
              )}

              {/* Rejection reason */}
              {previewVideo.status === 'REJECTED' && previewVideo.rejectionReason && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-wide mb-0.5">Rejected</p>
                  <p className="text-[12px] text-red-300">{previewVideo.rejectionReason}</p>
                </div>
              )}

              {/* Student / uploader info */}
              <div className="flex items-center gap-3 bg-white/8 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                  (previewVideo.uploaderType === 'STUDENT' || previewVideo.student)
                    ? 'bg-amber-400/20 text-amber-300'
                    : 'bg-blue-400/20 text-blue-300'
                }`}>
                  {previewVideo.student?.name?.[0] ?? previewVideo.appUser?.userId?.[0] ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-sm font-black text-white truncate">
                      {previewVideo.student?.name ?? previewVideo.appUser?.userId ?? 'â'}
                    </p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                      (previewVideo.uploaderType === 'STUDENT' || previewVideo.student)
                        ? 'bg-amber-400/20 text-amber-300'
                        : 'bg-blue-400/20 text-blue-300'
                    }`}>
                      {(previewVideo.uploaderType === 'STUDENT' || previewVideo.student) ? '🎓 Student' : '📱 Viewer'}
                    </span>
                  </div>
                  {previewVideo.student ? (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-white/40 font-mono">{previewVideo.student.olympiadCode}</p>
                      {previewVideo.student.allocation?.school && (
                        <div className="flex items-center gap-1">
                          <School size={10} className="text-blue-400 shrink-0" />
                          <p className="text-[12px] font-bold text-blue-300 truncate">
                            {previewVideo.student.allocation.school.name}
                          </p>
                        </div>
                      )}
                      {previewVideo.student.allocation?.school && (
                        <p className="text-[10px] text-white/25 truncate">
                          {[previewVideo.student.allocation.school.district, previewVideo.student.allocation.school.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  ) : previewVideo.appUser ? (
                    <div className="space-y-0.5">
                      <p className="text-[11px] text-white/40 truncate">{previewVideo.appUser.email || previewVideo.appUser.mobile || 'â'}</p>
                      {previewVideo.appUser.olympiadId && (
                        <p className="text-[11px] text-amber-400 font-mono">{previewVideo.appUser.olympiadId}</p>
                      )}
                      {previewVideo.appUser.school && (
                        <div className="flex items-center gap-1">
                          <School size={10} className="text-blue-400 shrink-0" />
                          <p className="text-[12px] font-bold text-blue-300 truncate">{previewVideo.appUser.school.name}</p>
                        </div>
                      )}
                      {previewVideo.appUser.school && (
                        <p className="text-[10px] text-white/25 truncate">
                          {[previewVideo.appUser.school.district, previewVideo.appUser.school.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                {filter === 'PENDING' && (
                  <>
                    <button onClick={() => approve(previewVideo)} disabled={processingId === previewVideo.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm transition-colors disabled:opacity-40">
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button onClick={() => openRejectModal(previewVideo)} disabled={processingId === previewVideo.id}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-sm transition-colors disabled:opacity-40">
                      <XCircle size={14} /> Reject
                    </button>
                  </>
                )}
                <button onClick={() => { setPreviewVideo(null); openDeleteModal([previewVideo.id]); }} disabled={processingId === previewVideo.id}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-red-400 rounded-xl font-black text-sm transition-colors disabled:opacity-40">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢ââ¬Ã¢ââ¬ Reject modal (single + bulk) Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      {(rejectModal.video || rejectModal.bulk) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl">
            <h2 className="text-sm font-black text-[#004f9f] mb-0.5">
              {rejectModal.bulk ? `Reject ${selectedIds.length} Videos` : 'Reject Video'}
            </h2>
            <p className="text-[11px] text-gray-400 mb-3">
              {rejectModal.bulk
                ? `All ${selectedIds.length} selected videos will be rejected with this reason.`
                : 'The student will see this reason on their profile.'}
            </p>

            {/* Quick-select templates */}
            <div className="mb-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Quick select</p>
              <div className="flex flex-wrap gap-1.5">
                {REJECTION_TEMPLATES.map(t => (
                  <button
                    key={t}
                    onClick={() => setRejectReason(t)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                      rejectReason === t
                        ? 'bg-red-600 text-white border-red-600'
                        : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 min-h-[70px] mt-2"
              placeholder="Or type a custom reasonâ¦"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />

            <div className="flex gap-2 mt-3">
              <button onClick={() => setRejectModal({ video: null, bulk: false })}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={confirmReject}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-colors">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢ââ¬Ã¢ââ¬ Delete confirmation modal Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬Ã¢ââ¬ */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#004f9f]">
                  Delete {deleteModal.ids.length > 1 ? `${deleteModal.ids.length} Videos` : 'Video'}?
                </h2>
                <p className="text-[11px] text-gray-400">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setDeleteModal(null)} disabled={deleting}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40">
                Cancel
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-colors disabled:opacity-40">
                {deleting ? <Clock size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleting ? 'Deletingâ¦' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

