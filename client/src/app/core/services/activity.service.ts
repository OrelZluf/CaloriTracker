import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Activity, ActivityAnalysis } from '../../shared/models/activity.model';
import { environment } from '../../../environments/environment';
import { LocalCacheService } from './local-cache.service';

const API_URL = environment.apiUrl;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalCacheService);

  private invalidateActivitySummaries(): void {
    this.cache.invalidatePrefixes(['daily_', 'weekly_', 'monthly_', 'insight_']);
  }

  analyzeText(description: string): Observable<ApiResponse<{ analysis: ActivityAnalysis }>> {
    return this.http.post<ApiResponse<{ analysis: ActivityAnalysis }>>(`${API_URL}/activities/analyze-text`, { description });
  }

  saveActivity(activity: Partial<Activity>): Observable<ApiResponse<Activity>> {
    return this.http.post<ApiResponse<Activity>>(`${API_URL}/activities`, activity).pipe(
      tap(() => this.invalidateActivitySummaries())
    );
  }

  updateActivity(id: number, activity: Partial<Activity>): Observable<ApiResponse<Activity>> {
    return this.http.put<ApiResponse<Activity>>(`${API_URL}/activities/${id}`, activity).pipe(
      tap(() => this.invalidateActivitySummaries())
    );
  }

  getActivities(date?: string): Observable<ApiResponse<{ activities: Activity[] }>> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<ApiResponse<{ activities: Activity[] }>>(`${API_URL}/activities`, { params });
  }

  deleteActivity(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${API_URL}/activities/${id}`).pipe(
      tap(() => this.invalidateActivitySummaries())
    );
  }
}
