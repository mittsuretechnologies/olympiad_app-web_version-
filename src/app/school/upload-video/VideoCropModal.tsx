'use client';

import { useEffect, useRef, useState } from 'react';
import { Crop, ArrowLeftRight, Loader2 } from 'lucide-react';

// Web version of the app's crop screen (Olympiad_App/Components/components/
// VideoCropModal.js): a landscape video plays in a box with a portrait (9:16)
// frame the school drags left/right to choose the part to keep. The cut itself
// happens on the server after upload (api/school/me/upload-video, cropX); this
// only picks the position, from 0 (left edge) to 1 (right edge).

const FRAME_RATIO = 9 / 16;

export default function VideoCropModal({ src, initialX = 0.5, onCrop, onKeepFull }: {
  src: string;
  initialX?: number;
  onCrop: (x: number) => void;
  onKeepFull: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(16 / 9);
  const [loaded, setLoaded] = useState(false);
  const [x, setX] = useState(initialX);
  const [boxW, setBoxW] = useState(640);
  const drag = useRef<{ startX: number; startLeft: number } | null>(null);

  // Fit the box to the stage, keeping the video's own shape.
  useEffect(() => {
    const fit = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const maxW = stage.clientWidth;
      const maxH = stage.clientHeight;
      setBoxW(Math.max(200, Math.min(maxW, maxH * ratio)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [ratio]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onKeepFull(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKeepFull]);

  const boxH = boxW / ratio;
  const frameW = Math.min(boxW, boxH * FRAME_RATIO);
  const range = Math.max(0, boxW - frameW);
  const left = x * range;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!loaded || range <= 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { startX: e.clientX, startLeft: left };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || range <= 0) return;
    const next = Math.min(range, Math.max(0, drag.current.startLeft + e.clientX - drag.current.startX));
    setX(next / range);
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Crop your video">
      <div className="mx-auto w-full max-w-3xl text-white">
        <h2 className="text-[17px] font-bold">Crop your video</h2>
        <p className="mt-1 text-[12.5px] text-white/70">
          Your video is landscape. Drag the frame to choose the part that fills the screen.
        </p>
      </div>

      <div ref={stageRef} className="mx-auto my-4 flex w-full max-w-3xl flex-1 min-h-0 items-center justify-center">
        <div className="relative select-none touch-none" style={{ width: boxW, height: boxH }}>
          <video
            src={src}
            className="absolute inset-0 h-full w-full object-fill"
            autoPlay muted loop playsInline
            onLoadedMetadata={e => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
              setLoaded(true);
            }}
          />
          {loaded ? (
            <div
              className="absolute inset-0 cursor-ew-resize"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* Dim what will be cut off on each side. */}
              <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: left }} />
              <div className="absolute inset-y-0 right-0 bg-black/60" style={{ left: left + frameW }} />
              <div className="absolute inset-y-0 border-2 border-white" style={{ left, width: frameW }}>
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
                <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45">
                  <ArrowLeftRight className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl gap-3">
        <button
          type="button"
          onClick={onKeepFull}
          className="h-11 flex-1 rounded-xl border border-white/40 text-[13.5px] font-bold text-white transition-colors hover:bg-white/10"
        >
          Keep full video
        </button>
        <button
          type="button"
          disabled={!loaded}
          onClick={() => onCrop(Math.round(x * 10000) / 10000)}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#3E82E0] via-[#1560C8] to-[#1FAE8E] text-[13.5px] font-black text-white disabled:opacity-50"
        >
          <Crop className="h-4 w-4" /> Crop
        </button>
      </div>
    </div>
  );
}
