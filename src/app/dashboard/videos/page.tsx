'use client';

import { useEffect, useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, Search, ExternalLink, MessageCircle } from 'lucide-react';

interface Video {
  id: string;
  videoUrl: string;
  caption: string;
  category: string;
  subCategory: string;
  status: string;
  createdAt: string;
  student: {
    name: string;
    olympiadCode: string;
    allocation: {
      school: {
        name: string;
        city: string;
      }
    }
  }
}

export default function VideoModerationPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos();
  }, [filter]);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/videos?status=${filter}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setVideos(data);
      } else {
        console.error('API response is not an array:', data);
        setVideos([]);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (videoId: string, status: 'APPROVED' | 'REJECTED') => {
    let reason = '';
    if (status === 'REJECTED') {
      reason = prompt('Enter rejection reason:') || '';
      if (!reason) return;
    }

    setProcessingId(videoId);
    try {
      const res = await fetch('/api/dashboard/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, status, rejectionReason: reason })
      });
      if (res.ok) {
        setVideos(videos.filter(v => v.id !== videoId));
      }
    } catch (error) {
      alert('Failed to update status');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#06013E]">Video Moderation</h1>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          {['PENDING', 'APPROVED', 'REJECTED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${
                filter === s ? 'bg-white text-[#06013E] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Clock className="animate-spin text-gray-400" size={32} />
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded-xl">
          <Play className="mx-auto text-gray-300 mb-2" size={48} />
          <p className="text-gray-500">No videos found in {filter.toLowerCase()} state.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="aspect-video bg-black relative group">
                <video src={video.videoUrl} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <a href={video.videoUrl} target="_blank" className="bg-white/20 p-3 rounded-full backdrop-blur-md">
                     <Play className="text-white fill-current" size={24} />
                   </a>
                </div>
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] text-white font-bold backdrop-blur-sm">
                  {video.category}
                </div>
              </div>
              
              <div className="p-4">
                <div className="mb-3">
                  <h3 className="font-bold text-[#06013E] text-sm truncate">{video.student?.name}</h3>
                  <p className="text-[10px] text-gray-500">
                    {video.student?.allocation?.school?.name || 'No School'} · {video.student?.allocation?.school?.city || 'No City'}
                  </p>
                </div>
                
                <div className="bg-gray-50 p-2 rounded text-[11px] text-gray-600 mb-4 line-clamp-2 h-10 italic">
                  "{video.caption || 'No caption provided'}"
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={processingId === video.id}
                    onClick={() => handleAction(video.id, 'APPROVED')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    disabled={processingId === video.id}
                    onClick={() => handleAction(video.id, 'REJECTED')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
