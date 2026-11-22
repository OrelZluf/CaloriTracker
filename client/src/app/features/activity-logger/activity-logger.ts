import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ActivityService } from '../../core/services/activity.service';
import { ActivityAnalysis, COMMON_ACTIVITIES, Activity } from '../../shared/models/activity.model';
import { toLocalDateStr } from '../../core/services/view-date.service';
import { AppleHealthService, APPLE_WATCH_ONE_TAP_PRESETS, AppleWatchPresetWorkout } from '../../core/services/apple-health.service';

type LogMode = 'text' | 'manual' | 'apple_watch';

@Component({
  selector: 'app-activity-logger',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './activity-logger.html',
  styleUrl: './activity-logger.css',
})
export class ActivityLogger implements OnInit {
  private readonly activityService = inject(ActivityService);
  private readonly appleHealthService = inject(AppleHealthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly selectedDate = signal<string | null>(null);
  readonly mode = signal<LogMode>('text');
  readonly isAnalyzing = signal(false);
  readonly error = signal<string | null>(null);
  readonly analysis = signal<ActivityAnalysis | null>(null);
  
  // Text Mode state
  readonly freeText = signal('');
  
  // Manual Mode state
  readonly commonActivities = COMMON_ACTIVITIES;
  readonly selectedActivity = signal<any>(null);
  readonly duration = signal<number | null>(null);

  // Apple Watch Mode state
  readonly appleWatchPresets = APPLE_WATCH_ONE_TAP_PRESETS;
  readonly watchActivity = signal<any>(COMMON_ACTIVITIES[2]); // Running default
  readonly watchDuration = signal<number | null>(35);
  readonly watchCalories = signal<number | null>(320);
  readonly watchSyncSuccess = signal<string | null>(null);

  /** True when opened from the dashboard (return there, to the same viewed day). */
  readonly fromDashboard = signal(false);

  /** Where to go back to: the viewed dashboard day, the history calendar, or today's dashboard. */
  backLink(): { path: string; queryParams: Record<string, string> } {
    const d = this.selectedDate();
    if (d && this.fromDashboard()) return { path: '/dashboard', queryParams: { date: d } };
    if (d) return { path: '/history', queryParams: { view: 'calendar', date: d } };
    return { path: '/dashboard', queryParams: {} };
  }

  private navigateAfterSave(_targetDate: string | null): void {
    const link = this.backLink();
    this.router.navigate([link.path], { queryParams: link.queryParams });
  }

  ngOnInit(): void {
    this.fromDashboard.set(this.route.snapshot.queryParamMap.get('from') === 'dashboard');
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const todayStr = toLocalDateStr();
      if (dateParam <= todayStr) {
        this.selectedDate.set(dateParam);
      } else {
        this.error.set('לא ניתן להוסיף פעילות בתאריך עתידי');
      }
    }
  }

  setMode(m: LogMode) {
    this.mode.set(m);
    this.error.set(null);
  }

  async analyzeText() {
    const text = this.freeText().trim();
    if (!text) {
      this.error.set('אנא תאר את הפעילות שלך');
      return;
    }

    this.isAnalyzing.set(true);
    this.error.set(null);

    try {
      this.activityService.analyzeText(text).subscribe({
        next: (res) => {
          if (res.success && res.data.analysis) {
            this.analysis.set(res.data.analysis);
          } else {
            this.error.set(res.message || 'שגיאה בניתוח הפעילות');
          }
        },
        error: (err) => {
          console.error('Analysis error:', err);
          this.error.set('שגיאה בניתוח הפעילות. נסה שוב.');
        },
        complete: () => {
          this.isAnalyzing.set(false);
        }
      });
    } catch (err) {
      this.isAnalyzing.set(false);
      this.error.set('שגיאה בתקשורת עם השרת');
    }
  }

  selectManualActivity(act: any) {
    this.selectedActivity.set(act);
  }

  async saveActivity() {
    const isTextMode = this.mode() === 'text';
    
    if (isTextMode && !this.analysis()) {
      return;
    }
    
    if (!isTextMode && (!this.selectedActivity() || !this.duration())) {
      this.error.set('אנא בחר פעילות והזן משך זמן');
      return;
    }

    const targetDate = this.selectedDate();
    const todayStr = toLocalDateStr();
    if (targetDate && targetDate > todayStr) {
      this.error.set('לא ניתן להוסיף פעילות בתאריך עתידי');
      return;
    }

    const payload: Partial<Activity> = isTextMode 
      ? {
          title: this.analysis()!.title,
          activity_type: this.analysis()!.activities[0].activity_type,
          duration_minutes: this.analysis()!.activities[0].duration_minutes,
          met_value: this.analysis()!.activities[0].met_value,
          input_method: 'text',
          raw_input: this.freeText(),
          date: targetDate || undefined
        }
      : {
          title: `פעילות מותאמת: ${this.selectedActivity().name}`,
          activity_type: this.selectedActivity().name,
          duration_minutes: this.duration()!,
          met_value: this.selectedActivity().met,
          input_method: 'manual',
          date: targetDate || undefined
        };

    this.isAnalyzing.set(true);
    this.error.set(null);

    this.activityService.saveActivity(payload).subscribe({
      next: (res) => {
        if (res.success) {
          this.navigateAfterSave(targetDate);
        } else {
          this.error.set(res.message || 'שגיאה בשמירת הפעילות');
          this.isAnalyzing.set(false);
        }
      },
      error: (err) => {
        this.error.set('שגיאה בתקשורת עם השרת');
        this.isAnalyzing.set(false);
      }
    });
  }

  oneTapSyncPreset(preset: AppleWatchPresetWorkout): void {
    const found = COMMON_ACTIVITIES.find(a => a.id === preset.activity_type) || COMMON_ACTIVITIES[2];
    this.watchActivity.set(found);
    this.watchDuration.set(preset.duration_minutes);
    this.watchCalories.set(preset.calories_burned);
    this.saveAppleWatchWorkout();
  }

  selectWatchActivity(act: any): void {
    this.watchActivity.set(act);
  }

  saveAppleWatchWorkout(): void {
    const act = this.watchActivity();
    const dur = Number(this.watchDuration());
    const cal = Number(this.watchCalories());

    if (!act || !dur || dur < 1) {
      this.error.set('אנא בחר סוג אימון והזן משך בדקות מהשעון');
      return;
    }
    if (!cal || cal < 1) {
      this.error.set('אנא הזן את הקלוריות הפעילות שנשרפו לפי Apple Watch');
      return;
    }

    const targetDate = this.selectedDate();
    const todayStr = toLocalDateStr();
    if (targetDate && targetDate > todayStr) {
      this.error.set('לא ניתן להוסיף פעילות בתאריך עתידי');
      return;
    }

    this.isAnalyzing.set(true);
    this.error.set(null);

    this.appleHealthService
      .syncWorkouts(
        [
          {
            external_id: `aw_manual_${Date.now()}`,
            activity_type: act.id,
            title: `${act.name} (Apple Watch)`,
            duration_minutes: dur,
            calories_burned: cal,
            met_value: act.met,
            date: targetDate || todayStr
          }
        ],
        targetDate
      )
      .subscribe({
        next: (res) => {
          this.isAnalyzing.set(false);
          if (res.success) {
            this.navigateAfterSave(targetDate);
          } else {
            this.error.set(res.message || 'שגיאה בסנכרון אימון מ-Apple Watch');
          }
        },
        error: () => {
          this.isAnalyzing.set(false);
          this.error.set('שגיאה בתקשורת עם השרת');
        }
      });
  }

  onAppleHealthFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    this.error.set(null);
    this.watchSyncSuccess.set(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = String(reader.result || '');
        const workouts = this.appleHealthService.parseAppleHealthFile(content, file.name);
        if (workouts.length === 0) {
          this.error.set('לא נמצאו אימונים בקובץ שנבחר. ודא שזהו קובץ XML או JSON מ-Apple Health.');
          return;
        }
        this.isAnalyzing.set(true);
        const targetDate = this.selectedDate();
        this.appleHealthService.syncWorkouts(workouts, targetDate).subscribe({
          next: (res) => {
            this.isAnalyzing.set(false);
            if (res.success) {
              this.navigateAfterSave(targetDate);
            } else {
              this.error.set(res.message || 'שגיאה בייבוא אימונים מ-Apple Watch');
            }
          },
          error: () => {
            this.isAnalyzing.set(false);
            this.error.set('שגיאה בייבוא קובץ Apple Health');
          }
        });
      } catch {
        this.error.set('קובץ Apple Health לא תקין.');
      }
    };
    reader.readAsText(file);
  }

  reset() {
    this.analysis.set(null);
    this.freeText.set('');
    this.error.set(null);
  }
}
