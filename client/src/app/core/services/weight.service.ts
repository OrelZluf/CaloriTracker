import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WeightDataResponse, WeightLog, WeightCoachSummary } from '../../shared/models/weight.model';
import { environment } from '../../../environments/environment';
import { LocalCacheService } from './local-cache.service';

const API_URL = environment.apiUrl;
const WEIGHT_TTL_MS = 24 * 60 * 60 * 1000;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class WeightService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalCacheService);

  private weightKey(days: number): string {
    return `weight_${days}`;
  }

  getCachedWeightHistory(days = 90): WeightDataResponse | null {
    return this.cache.get<WeightDataResponse>(this.weightKey(days), WEIGHT_TTL_MS);
  }

  getWeightHistory(days = 90): Observable<ApiResponse<WeightDataResponse>> {
    const params = new HttpParams().set('days', days.toString());
    const key = this.weightKey(days);
    return this.http.get<ApiResponse<WeightDataResponse>>(`${API_URL}/weight`, { params }).pipe(
      tap(res => {
        if (res?.data) {
          this.cache.set(key, res.data);
        }
      })
    );
  }

  logWeight(payload: { weight_kg: number; date?: string; note?: string }): Observable<ApiResponse<{ log: WeightLog; coach: WeightCoachSummary }>> {
    return this.http.post<ApiResponse<{ log: WeightLog; coach: WeightCoachSummary }>>(`${API_URL}/weight`, payload).pipe(
      tap(() => this.cache.invalidatePrefixes(['weight_']))
    );
  }

  deleteWeightLog(id: string | number): Observable<ApiResponse<{ coach: WeightCoachSummary }>> {
    return this.http.delete<ApiResponse<{ coach: WeightCoachSummary }>>(`${API_URL}/weight/${id}`).pipe(
      tap(() => this.cache.invalidatePrefixes(['weight_']))
    );
  }
}
