import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { ActivityService } from '../../core/services/activity.service';
import { ActivityAnalysis, COMMON_ACTIVITIES, Activity } from '../../shared/models/activity.model';
import { toLocalDateStr } from '../../core/services/view-date.service';

type LogMode = 'text' | 'manual';

@Component({
  selector: 'app-activity-logger',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './activity-logger.html',
  styleUrl: './activity-logger.css',
})
export class ActivityLogger implements OnInit {
  private readonly activityService = inject(ActivityService);
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

  reset() {
    this.analysis.set(null);
    this.freeText.set('');
    this.error.set(null);
  }
}
