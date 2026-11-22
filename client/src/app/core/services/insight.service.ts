import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DailyInsight } from '../../shared/models/insight.model';
import { LocalCacheService } from './local-cache.service';

@Injectable({
  providedIn: 'root'
})
export class InsightService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalCacheService);
  private readonly apiUrl = `${environment.apiUrl}/insights`;

  /**
   * Insight for a specific past day (YYYY-MM-DD, local date).
   * Past-day insights are immutable once generated, so if cached in localStorage
   * we return them immediately without a network call.
   */
  getDayInsight(date: string): Observable<DailyInsight | null> {
    const cacheKey = `insight_${date}`;
    const cached = this.cache.get<DailyInsight>(cacheKey);
    if (cached && cached.preserve_text) {
      return of(cached);
    }

    return this.http.get<{ status: string; data: { insight: DailyInsight | null } }>(`${this.apiUrl}/day`, { params: { date } }).pipe(
      map(response => response.data?.insight || null),
      tap(insight => {
        if (insight && insight.preserve_text) {
          this.cache.set(cacheKey, insight);
        }
      }),
      catchError(err => {
        console.error('Error fetching day insight:', err);
        return of(null);
      })
    );
  }

  getYesterdayInsight(): Observable<DailyInsight | null> {
    return this.http.get<{ status: string; data: { insight: DailyInsight | null } }>(`${this.apiUrl}/yesterday`).pipe(
      map(response => response.data?.insight || null),
      catchError(err => {
        console.error('Error fetching insight:', err);
        return of(null);
      })
    );
  }
}
