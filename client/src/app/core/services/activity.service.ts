import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Activity, ActivityAnalysis } from '../../shared/models/activity.model';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private http = inject(HttpClient);

  analyzeText(description: string): Observable<ApiResponse<{ analysis: ActivityAnalysis }>> {
    return this.http.post<ApiResponse<{ analysis: ActivityAnalysis }>>(`${API_URL}/activities/analyze-text`, { description });
  }

  saveActivity(activity: Partial<Activity>): Observable<ApiResponse<Activity>> {
    return this.http.post<ApiResponse<Activity>>(`${API_URL}/activities`, activity);
  }

  getActivities(date?: string): Observable<ApiResponse<{ activities: Activity[] }>> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<ApiResponse<{ activities: Activity[] }>>(`${API_URL}/activities`, { params });
  }

  deleteActivity(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${API_URL}/activities/${id}`);
  }
}
