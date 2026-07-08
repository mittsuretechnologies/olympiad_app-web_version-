import { prisma } from '@/lib/prisma';

export const REPORT_THRESHOLD_KEY = 'REPORT_THRESHOLD';
const DEFAULT_REPORT_THRESHOLD = 10;

export async function getReportThreshold(): Promise<number> {
  const row = await prisma.appSetting.findUnique({ where: { key: REPORT_THRESHOLD_KEY } });
  const parsed = row ? parseInt(row.value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REPORT_THRESHOLD;
}

export async function setReportThreshold(value: number): Promise<number> {
  const safeValue = Math.max(1, Math.floor(value));
  await prisma.appSetting.upsert({
    where:  { key: REPORT_THRESHOLD_KEY },
    update: { value: String(safeValue) },
    create: { key: REPORT_THRESHOLD_KEY, value: String(safeValue) },
  });
  return safeValue;
}
