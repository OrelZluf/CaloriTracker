import { Component, inject, signal, computed, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { DailySummary, WeeklySummary, MonthlySummary } from '../../shared/models/dashboard.model';
import { InsightService } from '../../core/services/insight.service';
import { DailyInsight } from '../../shared/models/insight.model';
import { ActionSheet, ActionSheetOption } from '../../shared/components/action-sheet/action-sheet';
import { Router } from '@angular/router';
import { ProfileSetupModal } from '../../shared/components/profile-setup-modal/profile-setup-modal';
import { DailyInsightModal } from '../../shared/components/daily-insight-modal/daily-insight-modal';

type TabType = 'daily' | 'weekly' | 'monthly';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, ActionSheet, ProfileSetupModal, DailyInsightModal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly insightService = inject(InsightService);
  private readonly router = inject(Router);

  readonly activeTab = signal<TabType>('daily');
  readonly isActionSheetOpen = signal(false);
  readonly actionOptions: ActionSheetOption[] = [
    { id: 'meal', label: 'הוסף ארוחה', icon: '🍽️', color: '#10b981' },
    { id: 'activity', label: 'הוסף פעילות גופנית', icon: '🏃', color: '#3b82f6' }
  ];
  readonly isLoading = signal(false);
  readonly dailySummary = signal<DailySummary>({
    date: new Date().toISOString().split('T')[0],
    total_calories: 0,
    total_protein: 0,
    total_carbs: 0,
    total_fat: 0,
    meals: [],
    calorie_goal: 2000,
  });
  readonly dailyInsight = signal<DailyInsight | null>(null);
  readonly isInsightLoading = signal(false);
  
  // Modal signals
  readonly isProfileSetupOpen = signal(false);
  readonly isInsightModalOpen = signal(false);
  
  readonly weeklySummary = signal<WeeklySummary | null>(null);
  readonly monthlySummary = signal<MonthlySummary | null>(null);

  readonly username = computed(() => this.authService.user()?.name ?? '');
  readonly calorieGoal = computed(() => this.authService.user()?.daily_calorie_goal ?? 2000);

  // Calorie progress
  readonly caloriesConsumed = computed(() => Math.round(this.dailySummary().total_calories));
  readonly caloriesBurned = computed(() => Math.round(this.dailySummary().total_calories_burned || 0));
  readonly netCalories = computed(() => Math.max(this.caloriesConsumed() - this.caloriesBurned(), 0));
  
  readonly caloriePercentage = computed(() => {
    const pct = (this.netCalories() / this.calorieGoal()) * 100;
    return Math.min(pct, 100);
  });
  readonly caloriesRemaining = computed(() => Math.max(this.calorieGoal() - this.netCalories(), 0));

  // Progress ring
  readonly ringRadius = 90;
  readonly ringCircumference = computed(() => 2 * Math.PI * this.ringRadius);
  readonly ringOffset = computed(() => {
    const c = this.ringCircumference();
    return c - (this.caloriePercentage() / 100) * c;
  });

  readonly progressColor = computed(() => {
    const pct = this.caloriePercentage();
    if (pct < 70) return '#10b981';
    if (pct < 90) return '#f97316';
    return '#ef4444';
  });

  // Macro percentages
  readonly proteinGrams = computed(() => Math.round(this.dailySummary().total_protein));
  readonly carbsGrams = computed(() => Math.round(this.dailySummary().total_carbs));
  readonly fatGrams = computed(() => Math.round(this.dailySummary().total_fat));

  // Macro donut
  readonly macroDonutSegments = computed(() => {
    const protein = this.proteinGrams() * 4;
    const carbs = this.carbsGrams() * 4;
    const fat = this.fatGrams() * 9;
    const total = protein + carbs + fat || 1;
    const circumference = 2 * Math.PI * 54;
    const proteinPct = (protein / total) * 100;
    const carbsPct = (carbs / total) * 100;
    const fatPct = (fat / total) * 100;

    return {
      protein: { dasharray: `${(proteinPct / 100) * circumference} ${circumference}`, dashoffset: 0, pct: Math.round(proteinPct) },
      carbs: { dasharray: `${(carbsPct / 100) * circumference} ${circumference}`, dashoffset: -(proteinPct / 100) * circumference, pct: Math.round(carbsPct) },
      fat: { dasharray: `${(fatPct / 100) * circumference} ${circumference}`, dashoffset: -((proteinPct + carbsPct) / 100) * circumference, pct: Math.round(fatPct) },
    };
  });

  // Weekly bars
  readonly weeklyBars = computed(() => {
    const weekly = this.weeklySummary();
    if (!weekly || !weekly.days) return [];
    const max = Math.max(...weekly.days.map(d => d.total_calories), this.calorieGoal());
    return weekly.days.map(d => ({
      ...d,
      heightPct: max > 0 ? (d.total_calories / max) * 100 : 0,
      isOverGoal: d.total_calories > this.calorieGoal(),
      dayLabel: new Date(d.date).toLocaleDateString('he-IL', { weekday: 'short' }),
    }));
  });

  readonly todayFormatted = computed(() => {
    return new Date().toLocaleDateString('he-IL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  });

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'בוקר טוב';
    if (h >= 12 && h < 17) return 'צהריים טובים';
    if (h >= 17 && h < 21) return 'ערב טוב';
    return 'לילה טוב';
  });

  ngOnInit(): void {
    const user = this.authService.user();
    if (user) {
      if (!user.weight_kg || !user.height_cm || !user.age) {
        this.isProfileSetupOpen.set(true);
      }
    }

    this.loadDaily();
    this.loadDailyInsight();
  }

  onProfileSaved(): void {
    this.authService.fetchProfile();
  }

  openActionSheet(event: Event): void {
    event.preventDefault();
    this.isActionSheetOpen.set(true);
  }

  handleActionSelect(actionId: string): void {
    this.isActionSheetOpen.set(false);
    if (actionId === 'meal') {
      this.router.navigate(['/add-meal']);
    } else if (actionId === 'activity') {
      this.router.navigate(['/add-activity']);
    }
  }

  switchTab(tab: TabType): void {
    this.activeTab.set(tab);
    if (tab === 'daily') this.loadDaily();
    else if (tab === 'weekly') this.loadWeekly();
    else this.loadMonthly();
  }

  private loadDaily(): void {
    this.isLoading.set(true);
    this.dashboardService.getDailySummary().subscribe({
      next: (res: any) => {
        const data = res.data || res;
        this.dailySummary.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  private loadDailyInsight(): void {
    this.isInsightLoading.set(true);
    this.insightService.getYesterdayInsight().subscribe({
      next: (insight) => {
        this.dailyInsight.set(insight);
        this.isInsightLoading.set(false);
      },
      error: () => this.isInsightLoading.set(false),
    });
  }

  openInsightModal(): void {
    this.isInsightModalOpen.set(true);
  }

  private loadWeekly(): void {
    this.isLoading.set(true);
    this.dashboardService.getWeeklySummary().subscribe({
      next: (res: any) => {
        const data = res.data || res;
        this.weeklySummary.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  private loadMonthly(): void {
    this.isLoading.set(true);
    this.dashboardService.getMonthlySummary().subscribe({
      next: (res: any) => {
        const data = res.data || res;
        this.monthlySummary.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  getMealTypeIcon(type: string): string {
    const icons: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎', other: '🍽️' };
    return icons[type] ?? '🍽️';
  }

  getMealTypeLabel(type: string): string {
    const labels: Record<string, string> = { breakfast: 'ארוחת בוקר', lunch: 'ארוחת צהריים', dinner: 'ארוחת ערב', snack: 'ארוחת ביניים', other: 'אחר' };
    return labels[type] ?? type;
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
}
