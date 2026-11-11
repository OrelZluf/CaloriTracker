import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

@Injectable({ providedIn: 'root' })
export class WaterService {
  private readonly http = inject(HttpClient);

  getWaterSummary(date?: string): Observable<WaterApiResponse> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<WaterApiResponse>(`${API_URL}/water`, { params });
  }

  addWater(amountMl: number, date?: string): Observable<WaterApiResponse> {
    return this.http.post<WaterApiResponse>(`${API_URL}/water`, {
      amount_ml: amountMl,
      date
    });
  }

  updateWaterSettings(glassMl: number, bottleMl: number, date?: string): Observable<WaterApiResponse> {
    return this.http.put<WaterApiResponse>(`${API_URL}/water/settings`, {
      glass_ml: glassMl,
      bottle_ml: bottleMl,
      date
    });
  }
}
