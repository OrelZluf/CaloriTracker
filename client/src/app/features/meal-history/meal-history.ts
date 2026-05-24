import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MealsService } from '../../core/services/meals.service';
import { Meal, MEAL_TYPE_LABELS } from '../../shared/models/meal.model';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { EditMealModal } from '../../shared/components/edit-meal-modal/edit-meal-modal';
import { ActivityService } from '../../core/services/activity.service';
import { Activity } from '../../shared/models/activity.model';
import { EditActivityModal } from '../../shared/components/edit-activity-modal/edit-activity-modal';
import { forkJoin } from 'rxjs';

export type HistoryItemType = 'meal' | 'activity';

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

@Component({
  selector: 'app-meal-history',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmModal, EditMealModal, EditActivityModal],
  templateUrl: './meal-history.html',
  styleUrl: './meal-history.css',
})
export class MealHistory implements OnInit {
  private readonly mealsService = inject(MealsService);
  private readonly activityService = inject(ActivityService);

  readonly meals = signal<Meal[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly mealGroups = signal<MealGroup[]>([]);
  readonly isLoading = signal(false);
  readonly currentPage = signal(1);
  readonly hasMore = signal(true);

  // Modals state
  readonly mealToDelete = signal<number | null>(null);
  readonly mealToEdit = signal<Meal | null>(null);
  readonly activityToDelete = signal<number | null>(null);
  readonly activityToEdit = signal<Activity | null>(null);
  readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadInitialData();
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
        this.hasMore.set(mData.page < mData.totalPages);
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
        this.hasMore.set(data.page < data.totalPages);
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
      const date = meal.created_at ? meal.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push({ type: 'meal', id: meal.id, title: meal.title, created_at: meal.created_at || '', data: meal });
    }

    for (const act of activities) {
      const date = act.created_at ? act.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push({ type: 'activity', id: act.id, title: act.title, created_at: act.created_at || '', data: act });
    }

    // Sort items within each day by created_at desc
    for (const [date, items] of groups.entries()) {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      dateLabel: this.formatDate(date),
      items,
    })).sort((a, b) => b.date.localeCompare(a.date));
  }

  formatDate(date: string): string {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
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
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
}
