import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Activity } from '../../shared/models/activity.model';

export interface AppleWatchWorkoutInput {
  external_id?: string;
  title?: string;
  activity_type?: string;
  workoutActivityType?: string;
  duration_minutes: number;
  calories_burned?: number;
  activeEnergyBurned?: number;
  met_value?: number;
  date?: string;
}

export interface AppleHealthStatusResponse {
  success: boolean;
  data: {
    connected: boolean;
    sync_token: string | null;
    webhook_path: string;
    synced_count: number;
    recent_activities: Activity[];
  };
}

export interface AppleHealthTokenResponse {
  success: boolean;
  message?: string;
  data: {
    sync_token: string;
    webhook_path: string;
  };
}

export interface AppleHealthSyncResponse {
  success: boolean;
  message?: string;
  data: {
    imported_count: number;
    skipped_duplicates: number;
    total_calories_burned: number;
    activities: Activity[];
  };
}

@Injectable({ providedIn: 'root' })
export class AppleHealthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/apple-health`;

  getStatus(): Observable<AppleHealthStatusResponse> {
    return this.http.get<AppleHealthStatusResponse>(`${this.apiUrl}/status`);
  }

  generateSyncToken(): Observable<AppleHealthTokenResponse> {
    return this.http.post<AppleHealthTokenResponse>(`${this.apiUrl}/token`, {});
  }

  syncWorkouts(workouts: AppleWatchWorkoutInput[], date?: string | null): Observable<AppleHealthSyncResponse> {
    return this.http.post<AppleHealthSyncResponse>(`${this.apiUrl}/sync`, {
      workouts,
      date: date || undefined
    });
  }

  /**
   * Parses an Apple Health export file (.xml or .json) in the browser
   * and extracts recent Workout records with duration and active calories burned.
   */
  parseAppleHealthFile(fileContent: string, fileName: string): AppleWatchWorkoutInput[] {
    const trimmed = fileContent.trim();
    if (!trimmed) return [];

    // 1. JSON format (e.g., Health Auto Export / iOS Shortcut JSON)
    if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.workouts)
          ? parsed.workouts
          : Array.isArray(parsed?.data?.workouts)
            ? parsed.data.workouts
            : [parsed];

      return list
        .filter((item: any) => item && typeof item === 'object')
        .map((item: any, idx: number) => ({
          external_id: item.external_id || item.id || `json_${idx}_${item.startDate || item.date || ''}`,
          workoutActivityType: item.workoutActivityType || item.activity_type || item.type || item.name || 'running',
          title: item.title,
          duration_minutes: Math.max(
            1,
            Math.round(Number(item.duration_minutes ?? item.duration ?? (item.duration_seconds ? item.duration_seconds / 60 : 30)) || 30)
          ),
          calories_burned: Math.round(Number(item.calories_burned ?? item.activeEnergyBurned ?? item.totalEnergyBurned ?? item.calories ?? 0)),
          date: String(item.date || item.startDate || '').split('T')[0].split(' ')[0] || undefined
        }));
    }

    // 2. Apple Health export.xml (<Workout ... />)
    const workoutRegex = /<Workout\b([^>]*?)(?:\/>|>[\s\S]*?<\/Workout>)/gi;
    const workouts: AppleWatchWorkoutInput[] = [];
    let match: RegExpExecArray | null;

    const getAttr = (attrs: string, name: string): string => {
      const m = new RegExp(`${name}="([^"]*)"`, 'i').exec(attrs);
      return m ? m[1] : '';
    };

    while ((match = workoutRegex.exec(trimmed)) !== null) {
      const attrs = match[1];
      const rawType = getAttr(attrs, 'workoutActivityType') || 'HKWorkoutActivityTypeRunning';
      const durationVal = parseFloat(getAttr(attrs, 'duration') || '30');
      const durationUnit = (getAttr(attrs, 'durationUnit') || 'min').toLowerCase();
      const durationMinutes = Math.max(
        1,
        Math.round(durationUnit.startsWith('sec') || durationUnit === 's' ? durationVal / 60 : durationVal)
      );
      const energyVal = Math.round(parseFloat(getAttr(attrs, 'totalEnergyBurned') || '0') || 0);
      const startDateRaw = getAttr(attrs, 'startDate') || getAttr(attrs, 'creationDate');
      const dateStr = startDateRaw ? startDateRaw.split(' ')[0].split('T')[0] : undefined;

      workouts.push({
        external_id: `hk_${dateStr || 'today'}_${rawType}_${durationMinutes}_${energyVal}`,
        workoutActivityType: rawType,
        duration_minutes: durationMinutes,
        calories_burned: energyVal > 0 ? energyVal : undefined,
        date: dateStr
      });
    }

    return workouts.slice(-30);
  }
}
