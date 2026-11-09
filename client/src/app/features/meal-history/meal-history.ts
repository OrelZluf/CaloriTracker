import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MealsService } from '../../core/services/meals.service';
import { Meal, Ingredient, MealType, MEAL_TYPE_LABELS } from '../../shared/models/meal.model';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { EditMealModal } from '../../shared/components/edit-meal-modal/edit-meal-modal';
import { ActivityService } from '../../core/services/activity.service';
import { Activity } from '../../shared/models/activity.model';
import { EditActivityModal } from '../../shared/components/edit-activity-modal/edit-activity-modal';
import { AuthService } from '../../core/services/auth.service';
import { forkJoin } from 'rxjs';

export type HistoryItemType = 'meal' | 'activity';
export type HistoryViewMode = 'list' | 'calendar';

export interface HistoryItem {
  type: HistoryItemType;
  id: number | undefined;
  title: string;
  created_at: string;
  data: Meal | Activity;
}

interface MealGroup {
  date: string;
  dateLabel: string;
  items: HistoryItem[];
}

export interface CalendarWeekDay {
  dateStr: string;
  dayNameShort: string;
  dayNumber: number;
  monthShort: string;
  isToday: boolean;
  isFuture: boolean;
  isSelected: boolean;
  totalCalories: number;
  totalBurned: number;
  netCalories: number;
  mealCount: number;
  activityCount: number;
}

@Component({
  selector: 'app-meal-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ConfirmModal, EditMealModal, EditActivityModal],
  templateUrl: './meal-history.html',
  styleUrl: './meal-history.css',
})
export class MealHistory implements OnInit {
  private readonly mealsService = inject(MealsService);
  private readonly activityService = inject(ActivityService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly viewMode = signal<HistoryViewMode>('list');
  readonly meals = signal<Meal[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly mealGroups = signal<MealGroup[]>([]);
  readonly isLoading = signal(false);
  readonly currentPage = signal(1);
  readonly hasMore = signal(true);

  // Calendar state
  readonly todayDateStr = this.toLocalDateStr(new Date());
  readonly weekOffset = signal<number>(0); // 0 = current week, -1 = previous week, etc.
  readonly selectedDate = signal<string>(this.todayDateStr);

  // Quick Add Historical Meal Modal state
  readonly isAddMealModalOpen = signal(false);
  readonly isSavingNewMeal = signal(false);
  readonly addMealError = signal<string | null>(null);
  readonly newMealTitle = signal('');
  readonly newMealType = signal<MealType>('lunch');
  readonly newMealCalories = signal<number | null>(null);
  readonly newMealProtein = signal<number | null>(null);
  readonly newMealCarbs = signal<number | null>(null);
  readonly newMealFat = signal<number | null>(null);
  readonly newMealGrams = signal<number | null>(100);

  // Modals state (Edit / Delete)
  readonly mealToDelete = signal<number | null>(null);
  readonly mealToEdit = signal<Meal | null>(null);
  readonly activityToDelete = signal<number | null>(null);
  readonly activityToEdit = signal<Activity | null>(null);
  readonly isDeleting = signal(false);

  readonly calorieGoal = computed(() => this.authService.user()?.daily_calorie_goal ?? 2000);

  readonly hebrewWeekdaysShort = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  readonly calendarWeekDays = computed<CalendarWeekDay[]>(() => {
    const offset = this.weekOffset();
    const selected = this.selectedDate();
    const todayStr = this.todayDateStr;

    const now = new Date();
    // Start of week (Sunday = 0)
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offset * 7);

    const mealsByDate = new Map<string, Meal[]>();
    for (const m of this.meals()) {
      const d = this.extractDateStr(m.created_at);
      if (!mealsByDate.has(d)) mealsByDate.set(d, []);
      mealsByDate.get(d)!.push(m);
    }

    const activitiesByDate = new Map<string, Activity[]>();
    for (const a of this.activities()) {
      const d = this.extractDateStr(a.created_at);
      if (!activitiesByDate.has(d)) activitiesByDate.set(d, []);
      activitiesByDate.get(d)!.push(a);
    }

    const days: CalendarWeekDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + i);
      const dateStr = this.toLocalDateStr(d);
      const dayMeals = mealsByDate.get(dateStr) || [];
      const dayActivities = activitiesByDate.get(dateStr) || [];

      const totalCalories = dayMeals.reduce((sum, m) => sum + (m.total_calories || 0), 0);
      const totalBurned = dayActivities.reduce((sum, a) => sum + (a.calories_burned || 0), 0);

      days.push({
        dateStr,
        dayNameShort: this.hebrewWeekdaysShort[d.getDay()],
        dayNumber: d.getDate(),
        monthShort: d.toLocaleDateString('he-IL', { month: 'short' }),
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
        isSelected: dateStr === selected,
        totalCalories: Math.round(totalCalories),
        totalBurned: Math.round(totalBurned),
        netCalories: Math.max(Math.round(totalCalories - totalBurned), 0),
        mealCount: dayMeals.length,
        activityCount: dayActivities.length,
      });
    }

    return days;
  });

  readonly weekRangeLabel = computed(() => {
    const days = this.calendarWeekDays();
    if (days.length === 0) return '';
    const first = this.parseDateStr(days[0].dateStr);
    const last = this.parseDateStr(days[days.length - 1].dateStr);
    const startFmt = first.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
    const endFmt = last.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startFmt} – ${endFmt}`;
  });

  readonly selectedDaySummary = computed(() => {
    const dateStr = this.selectedDate();
    const dayMeals = this.meals().filter(m => this.extractDateStr(m.created_at) === dateStr);
    const dayActivities = this.activities().filter(a => this.extractDateStr(a.created_at) === dateStr);

    const items: HistoryItem[] = [
      ...dayMeals.map(m => ({
        type: 'meal' as const,
        id: m.id,
        title: m.title,
        created_at: m.created_at || '',
        data: m
      })),
      ...dayActivities.map(a => ({
        type: 'activity' as const,
        id: a.id,
        title: a.title,
        created_at: a.created_at || '',
        data: a
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const totalCalories = Math.round(dayMeals.reduce((sum, m) => sum + (m.total_calories || 0), 0));
    const totalProtein = Math.round(dayMeals.reduce((sum, m) => sum + (m.total_protein || 0), 0));
    const totalCarbs = Math.round(dayMeals.reduce((sum, m) => sum + (m.total_carbs || 0), 0));
    const totalFat = Math.round(dayMeals.reduce((sum, m) => sum + (m.total_fat || 0), 0));
    const totalBurned = Math.round(dayActivities.reduce((sum, a) => sum + (a.calories_burned || 0), 0));
    const netCalories = Math.max(totalCalories - totalBurned, 0);

    return {
      dateStr,
      dateLabel: this.formatDate(dateStr),
      isFuture: dateStr > this.todayDateStr,
      items,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      totalBurned,
      netCalories
    };
  });

  ngOnInit(): void {
    const viewParam = this.route.snapshot.queryParamMap.get('view');
    const dateParam = this.route.snapshot.queryParamMap.get('date');

    if (viewParam === 'calendar') {
      this.viewMode.set('calendar');
    }

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= this.todayDateStr) {
      this.selectedDate.set(dateParam);
      this.syncWeekOffsetToDate(dateParam);
    }

    this.loadInitialData();
  }

  setViewMode(mode: HistoryViewMode): void {
    this.viewMode.set(mode);
  }

  previousWeek(): void {
    this.weekOffset.update(w => w - 1);
    this.selectDefaultDayInCurrentWeek();
  }

  nextWeek(): void {
    if (this.weekOffset() >= 0) return;
    this.weekOffset.update(w => w + 1);
    this.selectDefaultDayInCurrentWeek();
  }

  goToCurrentWeek(): void {
    this.weekOffset.set(0);
    this.selectedDate.set(this.todayDateStr);
  }

  selectCalendarDay(day: CalendarWeekDay): void {
    if (day.isFuture) return; // Future dates are unclickable
    this.selectedDate.set(day.dateStr);
  }

  private selectDefaultDayInCurrentWeek(): void {
    const days = this.calendarWeekDays();
    const nonFutureDays = days.filter(d => !d.isFuture);
    if (nonFutureDays.length > 0) {
      const todayMatch = nonFutureDays.find(d => d.isToday);
      this.selectedDate.set(todayMatch ? todayMatch.dateStr : nonFutureDays[nonFutureDays.length - 1].dateStr);
    }
  }

  private syncWeekOffsetToDate(dateStr: string): void {
    const target = this.parseDateStr(dateStr);
    const now = new Date();
    const startOfCurrentWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfTargetWeek = new Date(target.getFullYear(), target.getMonth(), target.getDate() - target.getDay());
    const diffDays = Math.round((startOfTargetWeek.getTime() - startOfCurrentWeek.getTime()) / (1000 * 60 * 60 * 24));
    const offset = Math.round(diffDays / 7);
    if (offset <= 0) {
      this.weekOffset.set(offset);
    }
  }

  openQuickAddMealModal(): void {
    if (this.selectedDate() > this.todayDateStr) return;
    this.newMealTitle.set('');
    this.newMealType.set('lunch');
    this.newMealCalories.set(null);
    this.newMealProtein.set(null);
    this.newMealCarbs.set(null);
    this.newMealFat.set(null);
    this.newMealGrams.set(100);
    this.addMealError.set(null);
    this.isAddMealModalOpen.set(true);
  }

  closeQuickAddMealModal(): void {
    if (!this.isSavingNewMeal()) {
      this.isAddMealModalOpen.set(false);
    }
  }

  saveQuickHistoricalMeal(): void {
    const title = this.newMealTitle().trim();
    const calories = this.newMealCalories();
    const targetDate = this.selectedDate();

    if (targetDate > this.todayDateStr) {
      this.addMealError.set('לא ניתן להוסיף ארוחה בתאריך עתידי.');
      return;
    }

    if (!title) {
      this.addMealError.set('אנא הזן שם לארוחה.');
      return;
    }

    if (calories === null || calories === undefined || calories < 0) {
      this.addMealError.set('אנא הזן כמות קלוריות תקינה.');
      return;
    }

    const ingredient: Ingredient = {
      name: title,
      category: 'other',
      estimated_grams: this.newMealGrams() || 100,
      calories: Math.round(calories),
      protein_grams: Math.round(this.newMealProtein() || 0),
      carbs_grams: Math.round(this.newMealCarbs() || 0),
      fat_grams: Math.round(this.newMealFat() || 0),
      fiber_grams: 0,
      sugar_grams: 0,
    };

    this.isSavingNewMeal.set(true);
    this.addMealError.set(null);

    this.mealsService
      .saveMeal({
        title,
        meal_type: this.newMealType(),
        input_method: 'text',
        raw_input: title,
        ingredients: [ingredient],
        date: targetDate,
      })
      .subscribe({
        next: (res) => {
          const createdMeal: Meal = res.data || {
            id: Date.now(),
            title,
            meal_type: this.newMealType(),
            total_calories: ingredient.calories,
            total_protein: ingredient.protein_grams,
            total_carbs: ingredient.carbs_grams,
            total_fat: ingredient.fat_grams,
            input_method: 'text',
            created_at: `${targetDate}T12:00:00.000Z`,
            ingredients: [ingredient],
          };
          if (!createdMeal.created_at) {
            createdMeal.created_at = `${targetDate}T12:00:00.000Z`;
          }
          if (!createdMeal.ingredients) {
            createdMeal.ingredients = [ingredient];
          }

          this.meals.update(list => [createdMeal, ...list]);
          this.mealGroups.set(this.groupItemsByDate(this.meals(), this.activities()));
          this.isSavingNewMeal.set(false);
          this.isAddMealModalOpen.set(false);
        },
        error: (err) => {
          this.addMealError.set(err?.error?.message || 'שגיאה בשמירת הארוחה.');
          this.isSavingNewMeal.set(false);
        },
      });
  }

  loadInitialData(): void {
    this.isLoading.set(true);
    forkJoin({
      mealsRes: this.mealsService.getMeals(1),
      activitiesRes: this.activityService.getActivities()
    }).subscribe({
      next: ({ mealsRes, activitiesRes }) => {
        const mData = (mealsRes as any).data || mealsRes;
        const aData = (activitiesRes as any).data || activitiesRes;
        
        this.meals.set(mData.meals || []);
        this.activities.set(aData.activities || []);
        
        this.mealGroups.set(this.groupItemsByDate(this.meals(), this.activities()));
        const totalPages = mData.totalPages ?? mData.pagination?.total_pages ?? 1;
        const page = mData.page ?? mData.pagination?.page ?? 1;
        this.hasMore.set(page < totalPages);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  loadMeals(): void {
    this.isLoading.set(true);
    this.mealsService.getMeals(this.currentPage()).subscribe({
      next: (res: any) => {
        const data = res.data || res;
        const newMeals = [...this.meals(), ...(data.meals || [])];
        this.meals.set(newMeals);
        this.mealGroups.set(this.groupItemsByDate(newMeals, this.activities()));
        const totalPages = data.totalPages ?? data.pagination?.total_pages ?? 1;
        const page = data.page ?? data.pagination?.page ?? 1;
        this.hasMore.set(page < totalPages);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  loadMore(): void {
    this.currentPage.update(p => p + 1);
    this.loadMeals();
  }

  promptDeleteMeal(id: number): void {
    this.mealToDelete.set(id);
  }

  cancelDelete(): void {
    this.mealToDelete.set(null);
    this.activityToDelete.set(null);
  }

  confirmDelete(): void {
    const mealId = this.mealToDelete();
    const activityId = this.activityToDelete();
    
    if (mealId) {
      this.isDeleting.set(true);
      this.mealsService.deleteMeal(mealId).subscribe({
        next: () => {
          this.meals.update(meals => meals.filter(m => m.id !== mealId));
          this.mealGroups.set(this.groupItemsByDate(this.meals(), this.activities()));
          this.isDeleting.set(false);
          this.mealToDelete.set(null);
        },
        error: () => this.isDeleting.set(false)
      });
    } else if (activityId) {
      this.isDeleting.set(true);
      this.activityService.deleteActivity(activityId).subscribe({
        next: () => {
          this.activities.update(acts => acts.filter(a => a.id !== activityId));
          this.mealGroups.set(this.groupItemsByDate(this.meals(), this.activities()));
          this.isDeleting.set(false);
          this.activityToDelete.set(null);
        },
        error: () => this.isDeleting.set(false)
      });
    }
  }

  openEdit(meal: Meal): void {
    this.mealToEdit.set(meal);
  }

  onMealEdited(updatedMeal: Meal): void {
    this.meals.update(meals => {
      const index = meals.findIndex(m => m.id === updatedMeal.id);
      if (index === -1) return meals;
      const newArray = [...meals];
      newArray[index] = updatedMeal;
      return newArray;
    });
    this.mealGroups.set(this.groupItemsByDate(this.meals(), this.activities()));
  }

  promptDeleteActivity(id: number): void {
    this.activityToDelete.set(id);
  }

  openEditActivity(activity: Activity): void {
    this.activityToEdit.set(activity);
  }

  onActivityEdited(updatedActivity: Activity): void {
    this.activities.update(acts => {
      const index = acts.findIndex(a => a.id === updatedActivity.id);
      if (index === -1) return acts;
      const newArray = [...acts];
      newArray[index] = updatedActivity;
      return newArray;
    });
    this.mealGroups.set(this.groupItemsByDate(this.meals(), this.activities()));
  }

  private groupItemsByDate(meals: Meal[], activities: Activity[]): MealGroup[] {
    const groups = new Map<string, HistoryItem[]>();
    
    for (const meal of meals) {
      const date = this.extractDateStr(meal.created_at);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push({ type: 'meal', id: meal.id, title: meal.title, created_at: meal.created_at || '', data: meal });
    }

    for (const act of activities) {
      const date = this.extractDateStr(act.created_at);
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push({ type: 'activity', id: act.id, title: act.title, created_at: act.created_at || '', data: act });
    }

    // Sort items within each day by created_at desc
    for (const [, items] of groups.entries()) {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      dateLabel: this.formatDate(date),
      items,
    })).sort((a, b) => b.date.localeCompare(a.date));
  }

  private extractDateStr(createdAt?: string): string {
    if (!createdAt) return this.todayDateStr;
    return createdAt.split('T')[0];
  }

  private toLocalDateStr(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateStr(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  formatDate(date: string): string {
    const d = this.parseDateStr(date);
    const today = this.parseDateStr(this.todayDateStr);
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'היום';
    if (d.toDateString() === yesterday.toDateString()) return 'אתמול';
    return d.toLocaleDateString('he-IL', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  getMealTypeIcon(type: string): string {
    const icons: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
    return icons[type] ?? '🍽️';
  }

  getMealTypeLabel(type: string): string {
    return (MEAL_TYPE_LABELS as any)[type] ?? type;
  }

  getActivityTypeIcon(type: string): string {
    const map: Record<string, string> = {
      running: '🏃', walking: '🚶', cycling: '🚴', swimming: '🏊',
      strength: '🏋️', yoga: '🧘', hiit: '⚡', sports: '⚽', other: '💪'
    };
    return map[type] || '💪';
  }

  getActivityTypeLabel(type: string): string {
    const map: Record<string, string> = {
      running: 'ריצה', walking: 'הליכה', cycling: 'רכיבה על אופניים', swimming: 'שחייה',
      strength: 'אימון כוח', yoga: 'יוגה', hiit: 'אימון בעצימות גבוהה', sports: 'ספורט', other: 'אחר'
    };
    return map[type] || 'פעילות גופנית';
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
}
