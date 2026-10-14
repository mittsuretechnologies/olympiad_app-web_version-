import type { StatusTone } from '../ui';
import type { SupportStatus } from '@/lib/schoolSupport';

/** Badge tone per request status. "Awaiting your reply" is the one that needs
 *  the school to act, so it gets the strongest tone. */
export const STATUS_TONE: Record<SupportStatus, StatusTone> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  AWAITING_SCHOOL: 'danger',
  RESOLVED: 'success',
};

export const getSchoolToken = () => (typeof window !== 'undefined' ? sessionStorage.getItem('schoolToken') || '' : '');

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
