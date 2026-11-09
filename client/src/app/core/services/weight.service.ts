import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WeightDataResponse, WeightLog, WeightCoachSummary } from '../../shared/models/weight.model';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class WeightService {
  private readonly http = inject(HttpClient);

  getWeightHistory(days = 90): Observable<ApiResponse<WeightDataResponse>> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<ApiResponse<WeightDataResponse>>(`${API_URL}/weight`, { params });
  }

  logWeight(payload: { weight_kg: number; date?: string; note?: string }): Observable<ApiResponse<{ log: WeightLog; coach: WeightCoachSummary }>> {
    return this.http.post<ApiResponse<{ log: WeightLog; coach: WeightCoachSummary }>>(`${API_URL}/weight`, payload);
  }

  deleteWeightLog(id: string | number): Observable<ApiResponse<{ coach: WeightCoachSummary }>> {
    return this.http.delete<ApiResponse<{ coach: WeightCoachSummary }>>(`${API_URL}/weight/${id}`);
  }
}
