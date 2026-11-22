import { Injectable, signal } from '@angular/core';

/** Local (device timezone) YYYY-MM-DD for a date. */
export function toLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Holds the day currently viewed on the dashboard, so that any "Add" entry point
 * (dashboard links, bottom nav, navbar) logs meals/activities to that day instead of today.
 */
@Injectable({ providedIn: 'root' })
export class ViewDateService {
  /** Viewed past date (YYYY-MM-DD), or null when viewing today / not on the dashboard. */
  readonly viewedDate = signal<string | null>(null);

  setViewedDate(dateStr: string | null): void {
    const today = toLocalDateStr();
    this.viewedDate.set(dateStr && dateStr < today ? dateStr : null);
  }

  /** Query params to pass to /add-meal or /add-activity. */
  addQueryParams(): Record<string, string> {
    const d = this.viewedDate();
    return d ? { date: d, from: 'dashboard' } : {};
  }
}
