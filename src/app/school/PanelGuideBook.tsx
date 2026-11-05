'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Download, Loader2, School, X } from 'lucide-react';
import HandbookBook, { type BookLabels } from '@/components/handbook/HandbookBook';
import { schoolGuide, type GuideLang } from '@/lib/handbook/school-guide';
import GuidePdfExport from './GuidePdfExport';
import { FOCUS } from './ui';

/**
 * The School Panel Guide, opened from the eye icon on the dashboard: the same
 * hardcover book as the Moderator Handbook, with an English / हिंदी switch.
 * Both editions have identical block order, so switching language keeps the
 * reader on the same section (HandbookBook anchors the place by block).
 */

const LABELS: Record<GuideLang, BookLabels> = {
  en: {
    coverTitle: ['School Panel', 'Guide'],
    coverTag: 'HOW-TO BOOK',
    runningTitle: 'School Panel Guide',
    section: 'Section',
    contents: 'Contents',
    version: 'Version',
    effectiveDate: 'Updated',
    previous: 'Previous',
    next: 'Next',
    closeBook: 'Close book',
    hint: 'Click or drag a page edge to turn · ← → keys',
    cover: 'Cover',
    backCover: 'Back cover',
    titlePage: 'Title page',
    pages: (nums, total) => `${nums.length > 1 ? 'Pages' : 'Page'} ${nums.join('–')} of ${total}`,
  },
  hi: {
    coverTitle: ['स्कूल पैनल', 'गाइड'],
    coverTag: 'हिंदी संस्करण',
    runningTitle: 'स्कूल पैनल गाइड',
    section: 'अध्याय',
    contents: 'विषय-सूची',
    version: 'संस्करण',
    effectiveDate: 'अपडेट',
    previous: 'पिछला',
    next: 'अगला',
    closeBook: 'किताब बंद करें',
    hint: 'पेज पलटने के लिए किनारे पर क्लिक करें या खींचें · ← → keys',
    cover: 'कवर',
    backCover: 'पिछला कवर',
    titlePage: 'शीर्षक पेज',
    pages: (nums, total) => `पृष्ठ ${nums.join('–')} / ${total}`,
  },
};

const LANG_KEY = 'schoolGuideLang';

function savedLang(): GuideLang {
  try { return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en'; } catch { return 'en'; }
}

export default function PanelGuideBook({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState<GuideLang>(savedLang);
  const [exporting, setExporting] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const changeLang = (l: GuideLang) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* preference only */ }
  };

  // Esc closes; the page underneath must not scroll while the book is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const title = lang === 'en' ? 'School Panel Guide' : 'स्कूल पैनल गाइड';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[#0B1B33]/75 p-2 backdrop-blur-[2px] sm:p-4"
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col overflow-hidden rounded-2xl bg-[#e9e2d3] shadow-2xl">
        {/* Title, language switch, close */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d7ccb6] bg-[#f5f0e6] px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <BookOpen size={17} className="flex-shrink-0 text-[#1c2a44]" />
            <h2 className="truncate text-[14px] font-semibold text-[#1c2a44]">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Downloads the edition being read. */}
            <button
              type="button"
              onClick={() => setExporting(true)}
              disabled={exporting}
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#d7ccb6] bg-white/70 px-2.5 text-[12.5px] font-semibold text-[#1c2a44] transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-70 ${FOCUS}`}
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="hidden sm:inline">
                {exporting
                  ? (lang === 'en' ? 'Preparing PDF…' : 'PDF बन रही है…')
                  : (lang === 'en' ? 'Download PDF' : 'PDF डाउनलोड करें')}
              </span>
            </button>
            <div className="inline-flex rounded-lg border border-[#d7ccb6] bg-white/70 p-0.5" role="group" aria-label="Language / भाषा">
              {([['en', 'English'], ['hi', 'हिंदी']] as const).map(([code, name]) => (
                <button
                  key={code}
                  type="button"
                  disabled={exporting}
                  onClick={() => changeLang(code)}
                  aria-pressed={lang === code}
                  className={`cursor-pointer rounded-md px-3 py-1 text-[12.5px] font-semibold transition-colors ${FOCUS} ${
                    lang === code ? 'bg-[#1c2a44] text-white' : 'text-[#5b4f3c] hover:bg-white'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={lang === 'en' ? 'Close guide' : 'गाइड बंद करें'}
              className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#5b4f3c] transition-colors hover:bg-white ${FOCUS}`}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden" lang={lang}>
          <HandbookBook handbook={schoolGuide(lang)} labels={LABELS[lang]} coverIcon={School} />
        </div>

        {exporting && (
          <GuidePdfExport
            handbook={schoolGuide(lang)}
            labels={LABELS[lang]}
            fileName={`Mittmee_School_Panel_Guide_${lang === 'en' ? 'English' : 'Hindi'}.pdf`}
            onDone={() => setExporting(false)}
          />
        )}
      </div>
    </div>
  );
}
