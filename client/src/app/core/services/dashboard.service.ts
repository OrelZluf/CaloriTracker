import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { DailySummary, WeeklySummary, MonthlySummary } from '../../shared/models/dashboard.model';
import { environment } from '../../../environments/environment';
import { LocalCacheService } from './local-cache.service';
import { toLocalDateStr } from './view-date.service';

const API_URL = environment.apiUrl;
const SUMMARY_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalCacheService);

  private dailyKey(date?: string): string {
    return `daily_${date || toLocalDateStr()}`;
  }

  private weeklyKey(date?: string): string {
    return `weekly_${date || toLocalDateStr()}`;
  }

  private monthlyKey(month?: number, year?: number): string {
    const now = new Date();
    return `monthly_${year ?? now.getFullYear()}_${month ?? (now.getMonth() + 1)}`;
  }

  getCachedDailySummary(date?: string): DailySummary | null {
    return this.cache.get<DailySummary>(this.dailyKey(date), SUMMARY_TTL_MS);
  }

  getCachedWeeklySummary(date?: string): WeeklySummary | null {
    return this.cache.get<WeeklySummary>(this.weeklyKey(date), SUMMARY_TTL_MS);
  }

  getCachedMonthlySummary(month?: number, year?: number): MonthlySummary | null {
    return this.cache.get<MonthlySummary>(this.monthlyKey(month, year), SUMMARY_TTL_MS);
  }

  getDailySummary(date?: string): Observable<DailySummary> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }

    const key = this.dailyKey(date);
    return this.http.get<DailySummary>(`${API_URL}/dashboard/daily`, { params }).pipe(
      tap((res: any) => {
        const data = res?.data || res;
        if (data && typeof data.total_calories === 'number') {
          this.cache.set(key, data);
        }
      }),
      catchError((error) => {
        console.error('שגיאה בטעינת סיכום יומי:', error);
        throw error;
      })
    );
  }

  getWeeklySummary(date?: string): Observable<WeeklySummary> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }

    const key = this.weeklyKey(date);
    return this.http.get<WeeklySummary>(`${API_URL}/dashboard/weekly`, { params }).pipe(
      tap((res: any) => {
        const data = res?.data || res;
        if (data) {
          this.cache.set(key, data);
        }
      }),
      catchError((error) => {
        console.error('שגיאה בטעינת סיכום שבועי:', error);
        throw error;
      })
    );
  }

  getMonthlySummary(month?: number, year?: number): Observable<MonthlySummary> {
    let params = new HttpParams();
    if (month !== undefined) {
      params = params.set('month', month.toString());
    }
    if (year !== undefined) {
      params = params.set('year', year.toString());
    }

    const key = this.monthlyKey(month, year);
    return this.http.get<MonthlySummary>(`${API_URL}/dashboard/monthly`, { params }).pipe(
      tap((res: any) => {
        const data = res?.data || res;
        if (data) {
          this.cache.set(key, data);
        }
      }),
      catchError((error) => {
        console.error('שגיאה בטעינת סיכום חודשי:', error);
        throw error;
      })
    );
  }
}
