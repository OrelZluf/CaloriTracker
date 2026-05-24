import { Component, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealsService } from '../../core/services/meals.service';
import { AuthService } from '../../core/services/auth.service';
import { Ingredient, MealAnalysis } from '../../shared/models/meal.model';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type InputMode = 'image' | 'text';

@Component({
  selector: 'app-meal-logger',
  imports: [CommonModule, FormsModule],
  templateUrl: './meal-logger.html',
  styleUrl: './meal-logger.css',
})
export class MealLogger {
  private readonly mealsService = inject(MealsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // State signals
  readonly mealType = signal<MealType>('lunch');
  readonly inputMode = signal<InputMode>('image');
  readonly selectedFile = signal<File | null>(null);
  readonly imagePreview = signal<string | null>(null);
  readonly textDescription = signal('');
  readonly isAnalyzing = signal(false);
  readonly isSaving = signal(false);
  readonly isDragOver = signal(false);
  readonly analysis = signal<MealAnalysis | null>(null);
  readonly imagePath = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Meal type options
  readonly mealTypes: { value: MealType; icon: string; label: string }[] = [
    { value: 'breakfast', icon: '🌅', label: 'בוקר' },
    { value: 'lunch', icon: '☀️', label: 'צהריים' },
    { value: 'dinner', icon: '🌙', label: 'ערב' },
    { value: 'snack', icon: '🍿', label: 'חטיף' },
  ];

  // Category config for badge styling
  readonly categoryConfig: Record<string, { icon: string; label: string; color: string }> = {
    protein: { icon: '🥩', label: 'חלבון', color: '#ef4444' },
    carb: { icon: '🍞', label: 'פחמימה', color: '#f59e0b' },
    fat: { icon: '🫒', label: 'שומן', color: '#8b5cf6' },
    vegetable: { icon: '🥬', label: 'ירק', color: '#22c55e' },
    fruit: { icon: '🍎', label: 'פרי', color: '#ec4899' },
    dairy: { icon: '🥛', label: 'חלבי', color: '#3b82f6' },
    other: { icon: '🍽️', label: 'אחר', color: '#6b7280' },
  };

  // Computed totals
  readonly totals = computed(() => {
    const result = this.analysis();
    if (!result) return null;
    return result.ingredients.reduce(
      (acc, ing) => ({
        calories: acc.calories + (ing.calories || 0),
        protein: acc.protein + (ing.protein_grams || 0),
        carbs: acc.carbs + (ing.carbs_grams || 0),
        fat: acc.fat + (ing.fat_grams || 0),
        grams: acc.grams + (ing.estimated_grams || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 }
    );
  });

  // Recommended calories per meal type (% of daily goal)
  private readonly mealTypePercentages: Record<MealType, { pct: number; label: string }> = {
    breakfast: { pct: 0.25, label: 'ארוחת בוקר' },
    lunch: { pct: 0.35, label: 'ארוחת צהריים' },
    dinner: { pct: 0.30, label: 'ארוחת ערב' },
    snack: { pct: 0.10, label: 'חטיף' },
  };

  readonly dailyGoal = computed(() => this.authService.user()?.daily_calorie_goal ?? 2000);

  readonly recommendedCalories = computed(() => {
    const info = this.mealTypePercentages[this.mealType()];
    return Math.round(this.dailyGoal() * info.pct);
  });

  readonly recommendedLabel = computed(() => this.mealTypePercentages[this.mealType()].label);

  readonly calorieComparison = computed(() => {
    const t = this.totals();
    if (!t) return null;
    const rec = this.recommendedCalories();
    const diff = t.calories - rec;
    const pct = rec > 0 ? Math.round((t.calories / rec) * 100) : 0;
    if (pct <= 100) return { status: 'good' as const, diff: Math.abs(diff), pct, icon: '✅', text: `בטווח המומלץ` };
    if (pct <= 120) return { status: 'warn' as const, diff, pct, icon: '⚠️', text: `${diff} קלוריות מעל המומלץ` };
    return { status: 'over' as const, diff, pct, icon: '🔴', text: `${diff} קלוריות מעל המומלץ` };
  });

  readonly recBarWidth = computed(() => {
    const t = this.totals();
    if (!t) return 0;
    return Math.min((t.calories / this.recommendedCalories()) * 100, 100);
  });

  readonly mealTypePct = computed(() => Math.round(this.mealTypePercentages[this.mealType()].pct * 100));

  readonly canAnalyze = computed(() => {
    if (this.isAnalyzing()) return false;
    if (this.inputMode() === 'image') return !!this.selectedFile();
    return this.textDescription().trim().length > 0;
  });

  // Handlers
  selectMealType(type: MealType): void {
    this.mealType.set(type);
  }

  switchMode(mode: InputMode): void {
    this.inputMode.set(mode);
    this.errorMessage.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        this.setFile(file);
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.setFile(input.files[0]);
    }
  }

  private setFile(file: File): void {
    this.selectedFile.set(file);
    this.analysis.set(null);
    this.errorMessage.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.analysis.set(null);
  }

  updateTextDescription(value: string): void {
    this.textDescription.set(value);
    this.errorMessage.set(null);
  }

  analyze(): void {
    this.isAnalyzing.set(true);
    this.errorMessage.set(null);
    this.analysis.set(null);

    if (this.inputMode() === 'image') {
      const file = this.selectedFile();
      if (!file) return;

      this.mealsService.analyzeImage(file).subscribe({
        next: (res) => {
          this.analysis.set(res.data.analysis);
          this.imagePath.set(res.data.image_path);
          this.isAnalyzing.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'שגיאה בניתוח התמונה. אנא נסה שוב.');
          this.isAnalyzing.set(false);
        },
      });
    } else {
      this.mealsService.analyzeText(this.textDescription()).subscribe({
        next: (res) => {
          this.analysis.set(res.data.analysis);
          this.isAnalyzing.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'שגיאה בניתוח הארוחה. אנא נסה שוב.');
          this.isAnalyzing.set(false);
        },
      });
    }
  }

  saveMeal(): void {
    const result = this.analysis();
    if (!result) return;

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.mealsService
      .saveMeal({
        title: result.title,
        meal_type: this.mealType(),
        image_path: this.imagePath() || undefined,
        input_method: this.inputMode(),
        raw_input: this.inputMode() === 'text' ? this.textDescription() : undefined,
        ingredients: result.ingredients,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'שגיאה בשמירת הארוחה. אנא נסה שוב.');
          this.isSaving.set(false);
        },
      });
  }

  getCategoryStyle(category: string): { icon: string; label: string; color: string } {
    return this.categoryConfig[category] || this.categoryConfig['other'];
  }

  removeIngredient(index: number): void {
    const current = this.analysis();
    if (!current) return;
    
    const newIngredients = [...current.ingredients];
    newIngredients.splice(index, 1);
    
    this.analysis.set({
      ...current,
      ingredients: newIngredients
    });
  }

  updateIngredientGrams(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newGrams = parseInt(input.value, 10);
    
    const current = this.analysis();
    if (!current || isNaN(newGrams) || newGrams < 0) return;
    
    const newIngredients = [...current.ingredients];
    const ingredient = { ...newIngredients[index] };
    const oldGrams = ingredient.estimated_grams || 1; // avoid division by 0
    const ratio = newGrams / oldGrams;
    
    ingredient.estimated_grams = newGrams;
    ingredient.calories = Math.round(ingredient.calories * ratio);
    ingredient.protein_grams = Math.round(ingredient.protein_grams * ratio);
    ingredient.carbs_grams = Math.round(ingredient.carbs_grams * ratio);
    ingredient.fat_grams = Math.round(ingredient.fat_grams * ratio);
    
    newIngredients[index] = ingredient;
    
    this.analysis.set({
      ...current,
      ingredients: newIngredients
    });
  }
}
