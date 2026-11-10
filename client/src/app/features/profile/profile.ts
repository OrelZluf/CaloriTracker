import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { WeightService } from '../../core/services/weight.service';
import { ThemeService } from '../../core/services/theme.service';
import { WeightLog, WeightCoachSummary } from '../../shared/models/weight.model';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly weightService = inject(WeightService);

  readonly user = this.authService.user;
  readonly isEditing = signal(false);
  
  // Form fields
  readonly formGoal = signal(2000);
  readonly formHeight = signal<number | null>(null);
  readonly formWeight = signal<number | null>(null);
  readonly formAge = signal<number | null>(null);
  readonly formGender = signal<'male' | 'female'>('male');
  
  readonly saved = signal(false);

  // Weight Trend & Dynamic TDEE Coach state
  readonly weightLogs = signal<WeightLog[]>([]);
  readonly weightCoach = signal<WeightCoachSummary | null>(null);
  readonly newWeightKg = signal<number | null>(null);
  readonly newWeightDate = signal<string>(new Date().toISOString().split('T')[0]);
  readonly newWeightNote = signal<string>('');
  readonly isLoggingWeight = signal(false);
  readonly isApplyingCoachGoal = signal(false);
  readonly weightToast = signal<string | null>(null);
  readonly weightError = signal<string | null>(null);

  readonly weightChartData = computed(() => {
    const logs = this.weightLogs();
    if (logs.length === 0) return null;

    const weights = logs.map(l => l.weight_kg);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = Math.max(maxW - minW, 1);

    const width = 300;
    const height = 90;
    const padX = 18;
    const padY = 16;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;

    const points = logs.map((log, idx) => {
      const x = logs.length === 1 ? width / 2 : padX + (idx / (logs.length - 1)) * usableW;
      const y = padY + usableH - ((log.weight_kg - minW) / range) * usableH;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        weight_kg: log.weight_kg,
        date: log.date,
        id: log.id
      };
    });

    const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

    return {
      minW,
      maxW,
      points,
      polyline
    };
  });

  ngOnInit(): void {
    this.loadWeightData();
  }

  loadWeightData(): void {
    this.weightService.getWeightHistory(90).subscribe({
      next: (res) => {
        if (res?.data) {
          this.weightLogs.set(res.data.logs || []);
          this.weightCoach.set(res.data.coach || null);
          if (this.newWeightKg() === null && this.user()?.weight_kg) {
            this.newWeightKg.set(this.user()!.weight_kg!);
          }
        }
      },
      error: () => {
        // Ignore if not mocked in legacy tests
      }
    });
  }

  submitWeightLog(): void {
    const w = this.newWeightKg();
    this.weightError.set(null);

    if (w === null || w === undefined || isNaN(w) || w < 20 || w > 500) {
      this.weightError.set('אנא הזן משקל תקין בין 20 ל-500 ק"ג.');
      return;
    }

    this.isLoggingWeight.set(true);
    this.weightService
      .logWeight({
        weight_kg: w,
        date: this.newWeightDate() || undefined,
        note: this.newWeightNote().trim() || undefined
      })
      .subscribe({
        next: (res) => {
          this.isLoggingWeight.set(false);
          if (res?.data?.log) {
            const added = res.data.log;
            this.weightLogs.update(list => {
              const filtered = list.filter(item => item.date !== added.date);
              return [...filtered, added].sort((a, b) => a.date.localeCompare(b.date));
            });
          }
          if (res?.data?.coach) {
            this.weightCoach.set(res.data.coach);
          }
          this.newWeightNote.set('');
          this.authService.fetchProfile();
          this.weightToast.set('✅ השקילה נשמרה בהצלחה!');
          setTimeout(() => this.weightToast.set(null), 3000);
        },
        error: (err) => {
          this.isLoggingWeight.set(false);
          this.weightError.set(err?.error?.message || 'שגיאה בשמירת השקילה.');
        }
      });
  }

  deleteWeightEntry(id?: string | number): void {
    if (!id) return;
    this.weightService.deleteWeightLog(id).subscribe({
      next: (res) => {
        this.weightLogs.update(list => list.filter(item => item.id !== id));
        if (res?.data?.coach) {
          this.weightCoach.set(res.data.coach);
        }
        this.authService.fetchProfile();
      }
    });
  }

  applyCoachGoal(): void {
    const coach = this.weightCoach();
    if (!coach || !coach.recommended_goal) return;

    this.isApplyingCoachGoal.set(true);
    this.authService
      .updateProfile({ daily_calorie_goal: coach.recommended_goal })
      .subscribe({
        next: (res) => {
          this.isApplyingCoachGoal.set(false);
          if (res.success) {
            this.authService.fetchProfile();
            this.weightCoach.set({
              ...coach,
              current_goal: coach.recommended_goal
            });
            this.weightToast.set(`🎯 יעד הקלוריות עודכן ל-${coach.recommended_goal} קל׳!`);
            setTimeout(() => this.weightToast.set(null), 3000);
          }
        },
        error: () => {
          this.isApplyingCoachGoal.set(false);
        }
      });
  }

  startEditing(): void {
    const u = this.user();
    if (u) {
      this.formGoal.set(u.daily_calorie_goal ?? 2000);
      this.formHeight.set(u.height_cm ?? null);
      this.formWeight.set(u.weight_kg ?? null);
      this.formAge.set(u.age ?? null);
      this.formGender.set(u.gender ?? 'male');
    }
    this.isEditing.set(true);
  }

  readonly bmi = computed(() => {
    const h = this.user()?.height_cm;
    const w = this.user()?.weight_kg;
    if (!h || !w) return null;
    const heightM = h / 100;
    return +(w / (heightM * heightM)).toFixed(1);
  });

  readonly bmiPercentage = computed(() => {
    const b = this.bmi();
    if (!b) return 0;
    // Scale: 15 to 40 is a range of 25. 
    // b=15 -> 0%, b=40 -> 100%
    let pct = ((b - 15) / 25) * 100;
    return Math.min(Math.max(pct, 0), 100);
  });

  readonly idealWeightRange = computed(() => {
    const h = this.user()?.height_cm;
    if (!h) return null;
    const heightM = h / 100;
    const minWeight = 18.5 * (heightM * heightM);
    const maxWeight = 24.9 * (heightM * heightM);
    return { min: Math.round(minWeight), max: Math.round(maxWeight) };
  });

  // Calculate BMR using Mifflin-St Jeor Equation based on the saved user
  readonly bmr = computed(() => {
    const u = this.user();
    if (!u?.weight_kg || !u?.height_cm || !u?.age || !u?.gender) return null;
    let bmr = (10 * u.weight_kg) + (6.25 * u.height_cm) - (5 * u.age);
    bmr += (u.gender === 'male') ? 5 : -161;
    return Math.round(bmr * 1.2);
  });

  // Calculate live BMR for the edit form
  readonly formBmr = computed(() => {
    const w = this.formWeight();
    const h = this.formHeight();
    const a = this.formAge();
    const g = this.formGender();
    if (!w || !h || !a || !g) return null;
    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr += (g === 'male') ? 5 : -161;
    return Math.round(bmr * 1.2);
  });

  applyRecommendation(): void {
    const rec = this.formBmr() || this.bmr();
    if (rec) {
      this.formGoal.set(rec);
    }
  }

  saveProfile(): void {
    // Auto-apply recommendation if goal is still the default 2000
    let finalGoal = this.formGoal();
    const liveBmr = this.formBmr();
    if (finalGoal === 2000 && liveBmr) {
      finalGoal = liveBmr;
      this.formGoal.set(liveBmr);
    }

    this.authService.updateProfile({
      daily_calorie_goal: finalGoal,
      height_cm: this.formHeight() === null || this.formHeight() === undefined ? null : this.formHeight(),
      weight_kg: this.formWeight() === null || this.formWeight() === undefined ? null : this.formWeight(),
      age: this.formAge() === null || this.formAge() === undefined ? null : this.formAge(),
      gender: this.formGender()
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.authService.fetchProfile();
          this.loadWeightData();
        }
        this.isEditing.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
      },
      error: () => {
        alert('שגיאה בשמירת הנתונים');
      }
    });
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  logout(): void {
    this.authService.logout();
  }
}
