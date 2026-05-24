import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DailyInsight } from '../../shared/models/insight.model';

@Injectable({
  providedIn: 'root'
})
export class InsightService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/insights`;

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
