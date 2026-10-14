import { prisma } from '@/lib/prisma';

export interface UploaderAppUser {
  id: string;
  email: string | null;
  olympiadId: string | null;
  guardianName: string | null;
  childName: string | null;
}

// The app account behind a video. Web-portal student uploads carry studentId
// instead of appUserId, so those reach the student's app account through its
// Olympiad code. Null when the uploader has no app account.
export async function findUploaderAppUser(video: {
  appUserId: string | null;
  studentId: string | null;
}): Promise<UploaderAppUser | null> {
  const select = { id: true, email: true, olympiadId: true, guardianName: true, childName: true } as const;

  if (video.appUserId) {
    const appUser = await prisma.appUser.findUnique({ where: { id: video.appUserId }, select });
    if (appUser) return appUser;
  }
  if (!video.studentId) return null;

  const student = await prisma.student.findUnique({ where: { id: video.studentId }, select: { olympiadCode: true } });
  return student
    ? prisma.appUser.findFirst({ where: { olympiadId: student.olympiadCode }, select })
    : null;
}

export function videoLabel(video: { caption: string | null; category: string | null; subCategory: string | null }) {
  return video.caption?.trim() || video.subCategory || video.category || 'your video';
}
