'use client';
// TEMPORARY visual check against the PDF — delete before commit.
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import ResultPassportV2, { type PassportV2Student } from '@/components/ResultPassportV2';

const texts = ['Trace the dotted lines.', 'Circle the body part that helps us see.', 'Count the balls and colour the correct number.', 'Circle the correct beginning letter.', 'Circle the dog.', 'Circle the good habit.', 'Identify the colour pattern and circle the correct colour.', 'Colour the picture.', 'Identify and colour the circles with the letter J.', 'Fill in the missing numbers.', 'Trace the dotted lines.', 'Fill in the missing letters.', 'Circle the odd one out.', 'Colour the happy face.', 'Colour as indicated.', 'Circle the healthy food items.', 'Colour the picture that starts with M.', 'Count the flowers and circle the correct number.', 'Circle the correct shadow of the giraffe.', 'Colour the circle showing classroom manners.'];
const lv = ['Progressing', 'Did not attempt', 'Progressing', 'Proficient', 'Proficient', 'Progressing', 'Beginner', 'Progressing', 'Proficient', 'Progressing', 'Progressing', 'Beginner', 'Progressing', 'Proficient', 'Progressing', 'Proficient', 'Progressing', 'Beginner', 'Progressing', 'Proficient'];
const student: PassportV2Student = {
  studentKey: 'x', name: 'Aanya Sharma', olympiadCode: 'LV-2026-27-00987', className: 'Nursery', schoolName: 'Bright Future Academy',
  state: null, district: null, city: null, avatarUrl: null,
  videos: [{ id: 'a', category: 'Dancing', subCategory: null, slot: 0, criteria: null, totalScore: null, isPublished: true, videoPercent: null, evaluatorName: null },
           { id: 'b', category: 'Recitation', subCategory: null, slot: 1, criteria: null, totalScore: null, isPublished: true, videoPercent: null, evaluatorName: null }],
  examPercentage: 60,
  examQuestions: texts.map((t, i) => ({ questionNumber: i + 1, pageNumber: 1, questionText: t, questionType: null, maxMarks: 1, score: 1, percentage: 50, performanceLevel: lv[i], manualPerformanceLevel: null, aiKoshas: [], manualKoshas: [] })),
  videoScoreTotal: 0, videoMaxScore: 0,
  koshBreakdown: [
    { kosh: 'ANNAMAYA', label: 'Annamaya Kosh', videoScore: 5, videoMaxScore: 8, grade: 'Progressing', examPercent: null, videoPercent: null, combinedPercent: 100 },
    { kosh: 'PRANAMAYA', label: 'Pranamaya Kosh', videoScore: 7, videoMaxScore: 8, grade: 'Proficient', examPercent: null, videoPercent: null, combinedPercent: 30 },
    { kosh: 'MANOMAYA', label: 'Manomaya Kosh', videoScore: 5, videoMaxScore: 8, grade: 'Progressing', examPercent: null, videoPercent: null, combinedPercent: 66 },
    { kosh: 'VIJNANAMAYA', label: 'Vijnanamaya Kosh', videoScore: 3, videoMaxScore: 8, grade: 'Beginner', examPercent: null, videoPercent: null, combinedPercent: 95 },
    { kosh: 'ANANDAMAYA', label: 'Anandamaya Kosh', videoScore: 5, videoMaxScore: 8, grade: 'Progressing', examPercent: null, videoPercent: null, combinedPercent: 62 },
  ],
  holisticPercent: 60, status: 'Complete',
};
function Inner() {
  const q = useSearchParams();
  const p = Number(q.get('p') || 0);
  useEffect(() => {
    if (!q.get('export')) return;
    const t = setTimeout(() => (Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Download PDF')) as HTMLButtonElement | undefined)?.click(), 3000);
    const iv = setInterval(() => console.log('EXPORT-STATE', Array.from(document.querySelectorAll('button')).map(b => b.textContent).filter(t => t?.includes('PDF')).join('|')), 2000);
    setTimeout(() => clearInterval(iv), 60000);
    return () => clearTimeout(t);
  }, [q]);
  return <ResultPassportV2 student={student} onClose={() => {}} initialPage={p} />;
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
