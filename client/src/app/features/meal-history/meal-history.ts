import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MealsService } from '../../core/services/meals.service';
import { Meal, MEAL_TYPE_LABELS } from '../../shared/models/meal.model';
import { ConfirmModal } from '../../shared/components/confirm-modal/confirm-modal';
import { EditMealModal } from '../../shared/components/edit-meal-modal/edit-meal-modal';

interface MealGroup {
  date: string;
  dateLabel: string;
  meals: Meal[];
}

@Component({
  selector: 'app-meal-history',
  standalone: true,
  imports: [CommonModule, RouterLink, ConfirmModal, EditMealModal],
  templateUrl: './meal-history.html',
  styleUrl: './meal-history.css',
})
export class MealHistory implements OnInit {
  private readonly mealsService = inject(MealsService);

  readonly meals = signal<Meal[]>([]);
  readonly mealGroups = signal<MealGroup[]>([]);
  readonly isLoading = signal(false);
  readonly currentPage = signal(1);
  readonly hasMore = signal(true);

  // Modals state
  readonly mealToDelete = signal<number | null>(null);
  readonly mealToEdit = signal<Meal | null>(null);
  readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadMeals();
  }

  loadMeals(): void {
    this.isLoading.set(true);
    this.mealsService.getMeals(this.currentPage()).subscribe({
      next: (res: any) => {
        const data = res.data || res;
        const newMeals = [...this.meals(), ...(data.meals || [])];
        this.meals.set(newMeals);
        this.mealGroups.set(this.groupByDate(newMeals));
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

  promptDelete(id: number): void {
    this.mealToDelete.set(id);
  }

  cancelDelete(): void {
    this.mealToDelete.set(null);
  }

  confirmDelete(): void {
    const id = this.mealToDelete();
    if (!id) return;
    
    this.isDeleting.set(true);
    this.mealsService.deleteMeal(id).subscribe({
      next: () => {
        this.meals.update(meals => meals.filter(m => m.id !== id));
        this.mealGroups.set(this.groupByDate(this.meals()));
        this.isDeleting.set(false);
        this.mealToDelete.set(null);
      },
      error: () => {
        this.isDeleting.set(false);
      }
    });
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
    this.mealGroups.set(this.groupByDate(this.meals()));
  }

  private groupByDate(meals: Meal[]): MealGroup[] {
    const groups = new Map<string, Meal[]>();
    for (const meal of meals) {
      const date = meal.created_at ? meal.created_at.split('T')[0] : new Date().toISOString().split('T')[0];
      if (!groups.has(date)) groups.set(date, []);
      groups.get(date)!.push(meal);
    }
    return Array.from(groups.entries()).map(([date, meals]) => ({
      date,
      dateLabel: this.formatDate(date),
      meals,
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

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
}
