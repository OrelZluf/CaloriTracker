import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { LocalCacheService } from './local-cache.service';
import { toLocalDateStr } from './view-date.service';

export interface WaterSummary {
  date: string;
  total_ml: number;
  goal_ml: number;
  glass_ml?: number;
  bottle_ml?: number;
  glasses_count: number;
  goal_glasses: number;
  percentage: number;
}

export interface WaterApiResponse {
  success: boolean;
  message?: string;
  data: WaterSummary;
}

const API_URL = environment.apiUrl;
const WATER_TTL_MS = 12 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class WaterService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalCacheService);

  private waterKey(date?: string): string {
    return `water_${date || toLocalDateStr()}`;
  }

  getCachedWaterSummary(date?: string): WaterSummary | null {
    return this.cache.get<WaterSummary>(this.waterKey(date), WATER_TTL_MS);
  }

  setCachedWaterSummary(date: string, summary: WaterSummary): void {
    this.cache.set(this.waterKey(date), summary);
  }

  getWaterSummary(date?: string): Observable<WaterApiResponse> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }
    const key = this.waterKey(date);
    return this.http.get<WaterApiResponse>(`${API_URL}/water`, { params }).pipe(
      tap(res => {
        if (res?.data) {
          this.cache.set(key, res.data);
        }
      })
    );
  }

  addWater(amountMl: number, date?: string): Observable<WaterApiResponse> {
    const key = this.waterKey(date);
    return this.http.post<WaterApiResponse>(`${API_URL}/water`, {
      amount_ml: amountMl,
      date
    }).pipe(
      tap(res => {
        if (res?.data) {
          this.cache.set(key, res.data);
        }
      })
    );
  }

  updateWaterSettings(glassMl: number, bottleMl: number, date?: string): Observable<WaterApiResponse> {
    const key = this.waterKey(date);
    return this.http.put<WaterApiResponse>(`${API_URL}/water/settings`, {
      glass_ml: glassMl,
      bottle_ml: bottleMl,
      date
    }).pipe(
      tap(res => {
        if (res?.data) {
          this.cache.set(key, res.data);
        }
      })
    );
  }
}
