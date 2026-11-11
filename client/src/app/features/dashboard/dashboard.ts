import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { DailySummary, WeeklySummary, MonthlySummary } from '../../shared/models/dashboard.model';
import { InsightService } from '../../core/services/insight.service';
import { DailyInsight } from '../../shared/models/insight.model';
import { ActionSheet, ActionSheetOption } from '../../shared/components/action-sheet/action-sheet';
import { ProfileSetupModal } from '../../shared/components/profile-setup-modal/profile-setup-modal';
import { DailyInsightModal } from '../../shared/components/daily-insight-modal/daily-insight-modal';
import { WeightService } from '../../core/services/weight.service';
import { WeightLog, WeightCoachSummary } from '../../shared/models/weight.model';
import { WaterService, WaterSummary } from '../../core/services/water.service';

type TabType = 'daily' | 'weekly' | 'monthly';
type MealSlotFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RouterLink, ActionSheet, ProfileSetupModal, DailyInsightModal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly insightService = inject(InsightService);
  private readonly weightService = inject(WeightService);
  private readonly waterService = inject(WaterService);
  private readonly router = inject(Router);

  readonly activeTab = signal<TabType>('daily');
  readonly selectedDate = signal<string>(this.toLocalDateStr(new Date()));
  readonly selectedMealSlot = signal<MealSlotFilter>('all');
  readonly expandedMealIds = signal<Set<number>>(new Set());

  // PWA Add to Home Screen Recommendation state
  readonly showPwaBanner = signal<boolean>(true);
  readonly showPwaInstructions = signal<boolean>(false);
  private deferredInstallPrompt: any = null;

  // Custom Water Glass & Bottle sizes (ml)
  readonly customGlassMl = signal<number>(250);
  readonly customBottleMl = signal<number>(500);
  readonly isWaterSettingsOpen = signal<boolean>(false);
  editGlassMl = 250;
  editBottleMl = 500;
  readonly glassPresets = [180, 200, 250, 330];
  readonly bottlePresets = [500, 750, 1000, 1500];

  readonly mealSlots: { key: MealSlotFilter; label: string; icon: string }[] = [
    { key: 'all', label: 'הכל', icon: '🍽️' },
    { key: 'breakfast', label: 'בוקר', icon: '🌅' },
    { key: 'lunch', label: 'צהריים', icon: '☀️' },
    { key: 'dinner', label: 'ערב', icon: '🌙' },
    { key: 'snack', label: 'נשנוש', icon: '🍎' },
  ];

  readonly isActionSheetOpen = signal(false);
  readonly actionOptions: ActionSheetOption[] = [
    { id: 'meal', label: 'הוסף ארוחה', icon: '🍽️', color: '#10b981' },
    { id: 'activity', label: 'הוסף פעילות גופנית', icon: '🏃', color: '#3b82f6' },
    { id: 'weight', label: 'תעד שקילה ומגמת משקל', icon: '⚖️', color: '#8b5cf6' }
  ];
  readonly weightLogs = signal<WeightLog[]>([]);
  readonly weightCoach = signal<WeightCoachSummary | null>(null);
  readonly waterSummary = signal<WaterSummary>({
    date: this.toLocalDateStr(new Date()),
    total_ml: 0,
    goal_ml: 2500,
    glass_ml: 250,
    bottle_ml: 500,
    glasses_count: 0,
    goal_glasses: 10,
    percentage: 0
  });
  readonly isLoading = signal(false);
  readonly dailySummary = signal<DailySummary>({
    date: this.toLocalDateStr(new Date()),
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

  // Date navigation helpers
  readonly isToday = computed(() => {
    const todayStr = this.toLocalDateStr(new Date());
    return this.selectedDate() === todayStr;
  });

  readonly selectedDateLabel = computed(() => {
    const dateStr = this.selectedDate();
    const todayStr = this.toLocalDateStr(new Date());
    if (dateStr === todayStr) return 'היום';

    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    if (dateStr === this.toLocalDateStr(yest)) return 'אתמול';

    const d = this.parseLocalDate(dateStr);
    return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
  });

  // Streak calculation based on weekly summary or today's meals
  readonly activeStreak = computed(() => {
    const weekly = this.weeklySummary();
    if (weekly?.days?.length) {
      let streak = 0;
      const sorted = [...weekly.days].sort((a, b) => b.date.localeCompare(a.date));
      for (const d of sorted) {
        if (d.total_calories > 0) streak++;
        else if (streak > 0) break;
      }
      if (streak > 0) return streak;
    }
    return this.dailySummary().meals.length > 0 ? 1 : 0;
  });

  // Filtered meals for daily view
  readonly filteredMeals = computed(() => {
    const slot = this.selectedMealSlot();
    const meals = this.dailySummary().meals || [];
    if (slot === 'all') return meals;
    return meals.filter(m => m.meal_type === slot);
  });

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
  readonly ringRadius = 82;
  readonly ringCircumference = computed(() => 2 * Math.PI * this.ringRadius);
  readonly ringOffset = computed(() => {
    const c = this.ringCircumference();
    return c - (this.caloriePercentage() / 100) * c;
  });

  readonly progressColor = computed(() => {
    const pct = this.caloriePercentage();
    if (pct < 75) return '#10b981';
    if (pct < 95) return '#f59e0b';
    return '#ef4444';
  });

  // Macro grams & remaining
  readonly proteinGrams = computed(() => Math.round(this.dailySummary().total_protein));
  readonly carbsGrams = computed(() => Math.round(this.dailySummary().total_carbs));
  readonly fatGrams = computed(() => Math.round(this.dailySummary().total_fat));

  readonly recommendedProteinGrams = computed(() => {
    const u = this.authService.user();
    if (u?.macro_protein_g) return u.macro_protein_g;
    return Math.round((this.calorieGoal() * 0.3) / 4);
  });
  
  readonly recommendedCarbsGrams = computed(() => {
    const u = this.authService.user();
    if (u?.macro_carbs_g) return u.macro_carbs_g;
    return Math.round((this.calorieGoal() * 0.4) / 4);
  });
  
  readonly recommendedFatGrams = computed(() => {
    const u = this.authService.user();
    if (u?.macro_fat_g) return u.macro_fat_g;
    return Math.round((this.calorieGoal() * 0.3) / 9);
  });

  readonly remainingProteinGrams = computed(() => Math.max(this.recommendedProteinGrams() - this.proteinGrams(), 0));
  readonly remainingCarbsGrams = computed(() => Math.max(this.recommendedCarbsGrams() - this.carbsGrams(), 0));
  readonly remainingFatGrams = computed(() => Math.max(this.recommendedFatGrams() - this.fatGrams(), 0));

  // Macro progress percentages
  readonly macroProgress = computed(() => {
    const proteinPct = Math.min((this.proteinGrams() / (this.recommendedProteinGrams() || 1)) * 100, 100) || 0;
    const carbsPct = Math.min((this.carbsGrams() / (this.recommendedCarbsGrams() || 1)) * 100, 100) || 0;
    const fatPct = Math.min((this.fatGrams() / (this.recommendedFatGrams() || 1)) * 100, 100) || 0;

    return {
      protein: Math.round(proteinPct),
      carbs: Math.round(carbsPct),
      fat: Math.round(fatPct),
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
    const d = this.parseLocalDate(this.selectedDate());
    return d.toLocaleDateString('he-IL', {
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

    this.initPwaBanner();
    this.initWaterCustomSizes();
    this.loadDaily();
    this.loadDailyInsight();
    this.loadWeightSummary();
  }

  private initPwaBanner(): void {
    if (typeof window === 'undefined') return;
    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator as any)?.standalone === true;
    const isDismissed = localStorage.getItem('ct_pwa_banner_dismissed') === 'true';

    this.showPwaBanner.set(!isStandalone && !isDismissed);

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (!localStorage.getItem('ct_pwa_banner_dismissed')) {
        this.showPwaBanner.set(true);
      }
    });
  }

  async handlePwaInstallClick(): Promise<void> {
    if (this.deferredInstallPrompt) {
      this.deferredInstallPrompt.prompt();
      const choice = await this.deferredInstallPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        this.dismissPwaBanner();
      }
      this.deferredInstallPrompt = null;
    } else {
      this.showPwaInstructions.update(v => !v);
    }
  }

  dismissPwaBanner(): void {
    this.showPwaBanner.set(false);
    this.showPwaInstructions.set(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ct_pwa_banner_dismissed', 'true');
    }
  }

  private initWaterCustomSizes(): void {
    const u = this.authService.user();
    const savedGlass = typeof localStorage !== 'undefined' ? Number(localStorage.getItem('ct_water_glass_ml')) : 0;
    const savedBottle = typeof localStorage !== 'undefined' ? Number(localStorage.getItem('ct_water_bottle_ml')) : 0;

    const glassMl = savedGlass >= 50 && savedGlass <= 2000
      ? savedGlass
      : (u?.water_glass_ml && u.water_glass_ml >= 50 ? u.water_glass_ml : 250);
    const bottleMl = savedBottle >= 100 && savedBottle <= 5000
      ? savedBottle
      : (u?.water_bottle_ml && u.water_bottle_ml >= 100 ? u.water_bottle_ml : 500);

    this.customGlassMl.set(glassMl);
    this.customBottleMl.set(bottleMl);
    this.editGlassMl = glassMl;
    this.editBottleMl = bottleMl;
  }

  toggleWaterSettings(): void {
    this.editGlassMl = this.customGlassMl();
    this.editBottleMl = this.customBottleMl();
    this.isWaterSettingsOpen.update(v => !v);
  }

  selectGlassPreset(ml: number): void {
    this.editGlassMl = ml;
  }

  selectBottlePreset(ml: number): void {
    this.editBottleMl = ml;
  }

  saveWaterSettings(): void {
    const glassMl = Math.min(2000, Math.max(50, Math.round(Number(this.editGlassMl) || 250)));
    const bottleMl = Math.min(5000, Math.max(100, Math.round(Number(this.editBottleMl) || 500)));

    this.customGlassMl.set(glassMl);
    this.customBottleMl.set(bottleMl);
    this.editGlassMl = glassMl;
    this.editBottleMl = bottleMl;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ct_water_glass_ml', String(glassMl));
      localStorage.setItem('ct_water_bottle_ml', String(bottleMl));
    }

    const curr = this.waterSummary();
    const goalMl = curr.goal_ml || 2500;
    this.waterSummary.set({
      ...curr,
      glass_ml: glassMl,
      bottle_ml: bottleMl,
      glasses_count: Math.floor(curr.total_ml / glassMl),
      goal_glasses: Math.max(1, Math.round(goalMl / glassMl))
    });
    this.isWaterSettingsOpen.set(false);

    this.waterService.updateWaterSettings(glassMl, bottleMl, this.selectedDate()).subscribe({
      next: (res) => {
        if (res?.data) {
          this.waterSummary.set(res.data);
        }
      },
      error: () => {
        // Optimistic state + localStorage already updated
      }
    });
  }

  changeDate(deltaDays: number): void {
    const current = this.parseLocalDate(this.selectedDate());
    current.setDate(current.getDate() + deltaDays);
    const nextStr = this.toLocalDateStr(current);
    const todayStr = this.toLocalDateStr(new Date());
    if (nextStr > todayStr) return;
    this.selectedDate.set(nextStr);
    this.loadDaily();
  }

  goToToday(): void {
    const todayStr = this.toLocalDateStr(new Date());
    if (this.selectedDate() !== todayStr) {
      this.selectedDate.set(todayStr);
      this.loadDaily();
    }
  }

  private toLocalDateStr(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseLocalDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  }

  selectMealSlot(slot: MealSlotFilter): void {
    this.selectedMealSlot.set(slot);
  }

  toggleMealExpand(mealId?: number): void {
    if (!mealId) return;
    this.expandedMealIds.update(set => {
      const next = new Set(set);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  }

  isMealExpanded(mealId?: number): boolean {
    return !!mealId && this.expandedMealIds().has(mealId);
  }

  private loadWeightSummary(): void {
    this.weightService.getWeightHistory(30).subscribe({
      next: (res) => {
        if (res?.data) {
          this.weightLogs.set(res.data.logs || []);
          this.weightCoach.set(res.data.coach || null);
        }
      },
      error: () => {
        // Optional widget; ignore if unmocked
      }
    });
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
    } else if (actionId === 'weight') {
      this.router.navigate(['/profile']);
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
    const dateParam = this.isToday() ? undefined : this.selectedDate();
    this.loadWater(this.selectedDate());
    this.dashboardService.getDailySummary(dateParam).subscribe({
      next: (res: any) => {
        const data = res.data || res;
        this.dailySummary.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  private loadWater(dateStr: string): void {
    const u = this.authService.user();
    const defaultGoal = u?.weight_kg ? Math.min(4000, Math.max(1800, Math.round((u.weight_kg * 35) / 50) * 50)) : 2500;
    const glassMl = this.customGlassMl() || 250;
    const bottleMl = this.customBottleMl() || 500;

    this.waterService.getWaterSummary(dateStr).subscribe({
      next: (res) => {
        if (res?.data) {
          const serverGlass = res.data.glass_ml;
          const serverBottle = res.data.bottle_ml;
          const savedLocalGlass = typeof localStorage !== 'undefined' ? Number(localStorage.getItem('ct_water_glass_ml')) : 0;
          const savedLocalBottle = typeof localStorage !== 'undefined' ? Number(localStorage.getItem('ct_water_bottle_ml')) : 0;

          const effectiveGlass = savedLocalGlass >= 50 ? savedLocalGlass : (serverGlass || glassMl);
          const effectiveBottle = savedLocalBottle >= 100 ? savedLocalBottle : (serverBottle || bottleMl);

          this.customGlassMl.set(effectiveGlass);
          this.customBottleMl.set(effectiveBottle);

          const totalMl = res.data.total_ml || 0;
          const goalMl = res.data.goal_ml || defaultGoal;
          this.waterSummary.set({
            ...res.data,
            glass_ml: effectiveGlass,
            bottle_ml: effectiveBottle,
            glasses_count: Math.floor(totalMl / effectiveGlass),
            goal_glasses: Math.max(1, Math.round(goalMl / effectiveGlass))
          });
        }
      },
      error: () => {
        this.waterSummary.set({
          date: dateStr,
          total_ml: 0,
          goal_ml: defaultGoal,
          glass_ml: glassMl,
          bottle_ml: bottleMl,
          glasses_count: 0,
          goal_glasses: Math.max(1, Math.round(defaultGoal / glassMl)),
          percentage: 0
        });
      }
    });
  }

  addWater(deltaMl: number): void {
    const curr = this.waterSummary();
    const glassMl = this.customGlassMl() || 250;
    const nextMl = Math.max(0, curr.total_ml + deltaMl);
    const goalMl = curr.goal_ml || 2500;
    this.waterSummary.set({
      ...curr,
      total_ml: nextMl,
      glass_ml: glassMl,
      bottle_ml: this.customBottleMl() || 500,
      glasses_count: Math.floor(nextMl / glassMl),
      goal_glasses: Math.max(1, Math.round(goalMl / glassMl)),
      percentage: Math.min(100, Math.round((nextMl / goalMl) * 100))
    });

    this.waterService.addWater(deltaMl, this.selectedDate()).subscribe({
      next: (res) => {
        if (res?.data) {
          const totalMl = res.data.total_ml ?? nextMl;
          const gMl = res.data.goal_ml || goalMl;
          this.waterSummary.set({
            ...res.data,
            glass_ml: glassMl,
            bottle_ml: this.customBottleMl() || 500,
            glasses_count: Math.floor(totalMl / glassMl),
            goal_glasses: Math.max(1, Math.round(gMl / glassMl))
          });
        }
      },
      error: () => {
        // Keep optimistic state if offline/unmocked
      }
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
    const map: Record<string, string> = {
      breakfast: 'ארוחת בוקר',
      lunch: 'ארוחת צהריים',
      dinner: 'ארוחת ערב',
      snack: 'נשנוש'
    };
    return map[type] || 'ארוחה';
  }

  getActivityTypeIcon(type: string): string {
    const map: Record<string, string> = {
      running: '🏃',
      walking: '🚶',
      cycling: '🚴',
      swimming: '🏊',
      strength: '🏋️',
      yoga: '🧘',
      hiit: '⚡',
      sports: '⚽',
      other: '💪'
    };
    return map[type] || '💪';
  }

  getActivityTypeLabel(type: string): string {
    const map: Record<string, string> = {
      running: 'ריצה',
      walking: 'הליכה',
      cycling: 'רכיבה על אופניים',
      swimming: 'שחייה',
      strength: 'אימון כוח',
      yoga: 'יוגה',
      hiit: 'אימון בעצימות גבוהה',
      sports: 'ספורט',
      other: 'אחר'
    };
    return map[type] || 'פעילות גופנית';
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
}
