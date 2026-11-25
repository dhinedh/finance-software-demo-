import { format, parseISO, isValid, subDays, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getYesterdayDateString(): string {
  return format(subDays(new Date(), 1), 'yyyy-MM-dd');
}

export function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const parsed = parseISO(dateStr);
    if (!isValid(parsed)) return dateStr;
    return format(parsed, 'dd-MM-yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTimeDisplay(dateTimeStr?: string | null): string {
  if (!dateTimeStr) return '-';
  try {
    const parsed = new Date(dateTimeStr);
    if (!isValid(parsed)) return dateTimeStr;
    return format(parsed, 'dd-MM-yyyy hh:mm a');
  } catch {
    return dateTimeStr;
  }
}

export type DateFilterType = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom' | 'all';

export function getDateRangeFromFilter(filter: DateFilterType, customFrom?: string, customTo?: string): { from: string; to: string } {
  const today = new Date();
  const todayStr = getTodayDateString();

  switch (filter) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case 'yesterday': {
      const yest = getYesterdayDateString();
      return { from: yest, to: yest };
    }
    case 'this_week': {
      const start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      return { from: start, to: end };
    }
    case 'this_month': {
      const start = format(startOfMonth(today), 'yyyy-MM-dd');
      const end = format(endOfMonth(today), 'yyyy-MM-dd');
      return { from: start, to: end };
    }
    case 'custom':
      return {
        from: customFrom || '2000-01-01',
        to: customTo || todayStr,
      };
    case 'all':
    default:
      return {
        from: '2000-01-01',
        to: '2099-12-31',
      };
  }
}

/**
 * Returns default expected collection date (+7 days from sales date).
 */
export function getDefaultCollectionDate(salesDateStr?: string): string {
  try {
    const base = salesDateStr ? parseISO(salesDateStr) : new Date();
    if (!isValid(base)) return format(addDays(new Date(), 7), 'yyyy-MM-dd');
    return format(addDays(base, 7), 'yyyy-MM-dd');
  } catch {
    return format(addDays(new Date(), 7), 'yyyy-MM-dd');
  }
}
