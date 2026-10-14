// Email side-effects of School Panel Help & Support. Every call is
// best-effort: the ticket/message is already saved when these run, so a mail
// failure is logged and never surfaces as a failed request.

import { sendSchoolSupportSchoolEmail, sendSchoolSupportTeamEmail } from '@/lib/mailer';
import { categoryLabel, ticketRef } from '@/lib/schoolSupport';
import { isEmail } from '@/lib/agreements/server';

interface TicketForMail {
  id: string;
  ticketNo: number;
  subject: string;
  category: string;
  priority: string;
  contactName: string | null;
  contactPhone: string | null;
  school: { name: string; schoolId: string; email: string | null };
}

const schoolEmailOf = (t: TicketForMail) => (isEmail(t.school.email) ? t.school.email!.trim() : null);

export async function notifyTeam(t: TicketForMail, event: 'NEW' | 'SCHOOL_REPLY', message: string, attachmentCount: number) {
  try {
    await sendSchoolSupportTeamEmail({
      event,
      ticketRef: ticketRef(t.ticketNo),
      ticketId: t.id,
      subject: t.subject,
      category: categoryLabel(t.category),
      priority: t.priority,
      schoolName: t.school.name,
      schoolCode: t.school.schoolId,
      schoolEmail: schoolEmailOf(t),
      contactName: t.contactName,
      contactPhone: t.contactPhone,
      message,
      attachmentCount,
    });
  } catch (err) {
    console.error(`School support team email (${event}) failed for ${ticketRef(t.ticketNo)}:`, err);
  }
}

export async function notifySchool(t: TicketForMail, event: 'RECEIVED' | 'TEAM_REPLY' | 'RESOLVED', message?: string | null) {
  const to = schoolEmailOf(t);
  if (!to) return;
  try {
    await sendSchoolSupportSchoolEmail({
      event,
      to,
      schoolName: t.school.name,
      ticketRef: ticketRef(t.ticketNo),
      subject: t.subject,
      message: message ?? null,
    });
  } catch (err) {
    console.error(`School support school email (${event}) failed for ${ticketRef(t.ticketNo)}:`, err);
  }
}

/** Prisma select for the fields the notifications need. */
export const TICKET_MAIL_SELECT = {
  id: true, ticketNo: true, subject: true, category: true, priority: true,
  contactName: true, contactPhone: true,
  school: { select: { name: true, schoolId: true, email: true } },
} as const;
