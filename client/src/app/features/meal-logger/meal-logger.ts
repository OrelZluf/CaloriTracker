import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealsService } from '../../core/services/meals.service';
import { AuthService } from '../../core/services/auth.service';
import { Ingredient, Meal, MealAnalysis } from '../../shared/models/meal.model';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
type InputMode = 'image' | 'text' | 'barcode' | 'favorites';

@Component({
  selector: 'app-meal-logger',
  imports: [CommonModule, FormsModule],
  templateUrl: './meal-logger.html',
  styleUrl: './meal-logger.css',
})
export class MealLogger implements OnInit {
  private readonly mealsService = inject(MealsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // State signals
  readonly selectedDate = signal<string | null>(null);
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
  readonly saveAsFavorite = signal(false);

  // Barcode & Nutrition Label scanner state
  readonly barcodeInput = signal<string>('');
  readonly israelliProductPresets = [
    { code: '7290004127329', label: '🧀 קוטג׳ תנובה 5% (250g)' },
    { code: '7290107940016', label: '🥛 דנונה PRO חלבון 20g' },
    { code: '7290004131074', label: '🥤 משקה חלבון GO (25g)' },
    { code: '7290000802220', label: '🍞 לחם עינן מלא אנג׳ל' },
    { code: '7290000068787', label: '🥜 במבה אסם (80g)' },
  ];

  // Favorites quick-log state
  readonly favoriteMeals = signal<Meal[]>([]);
  readonly isLoadingFavorites = signal(false);
  readonly selectedMultiplier = signal<number>(1);
  readonly multiplierOptions = [0.5, 1, 1.5, 2];

  ngOnInit(): void {
    const dateParam = this.route.snapshot.queryParamMap.get('date');
    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (dateParam <= todayStr) {
        this.selectedDate.set(dateParam);
      } else {
        this.errorMessage.set('לא ניתן להוסיף ארוחה בתאריך עתידי.');
      }
    }
  }

  // Meal type options
  readonly mealTypes: { value: MealType; icon: string; label: string }[] = [
    { value: 'breakfast', icon: '🌅', label: 'בוקר' },
    { value: 'lunch', icon: '☀️', label: 'צהריים' },
    { value: 'dinner', icon: '🌙', label: 'ערב' },
    { value: 'snack', icon: '🍎', label: 'ביניים' },
    { value: 'other', icon: '🍽️', label: 'אחר' },
  ];

  // Category config for badge styling (Unified Semantic Palette)
  readonly categoryConfig: Record<string, { icon: string; label: string; color: string }> = {
    protein: { icon: '🥩', label: 'חלבון', color: '#3b82f6' },
    carb: { icon: '🍞', label: 'פחמימה', color: '#f59e0b' },
    fat: { icon: '🥑', label: 'שומן', color: '#8b5cf6' },
    vegetable: { icon: '🥬', label: 'ירק', color: '#10b981' },
    fruit: { icon: '🍎', label: 'פרי', color: '#ec4899' },
    dairy: { icon: '🥛', label: 'חלבי', color: '#06b6d4' },
    other: { icon: '🍽️', label: 'אחר', color: '#64748b' },
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
    snack: { pct: 0.10, label: 'ארוחת ביניים' },
    other: { pct: 0, label: 'אחר' },
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
    if (mode === 'favorites') {
      this.loadFavorites();
    }
  }

  searchBarcode(presetCode?: string): void {
    const code = (presetCode ?? this.barcodeInput()).trim();
    if (!code) {
      this.errorMessage.set('אנא הזן מספר ברקוד לחיפוש.');
      return;
    }
    this.barcodeInput.set(code);
    this.isAnalyzing.set(true);
    this.errorMessage.set(null);
    this.analysis.set(null);

    this.mealsService.lookupBarcode(code).subscribe({
      next: (res) => {
        this.analysis.set(res.data.analysis);
        this.isAnalyzing.set(false);
      },
      error: (err) => {
        this.errorMessage.set(
          err.error?.message || 'המוצר לא נמצא במאגר הברקודים. מומלץ לצלם את טבלת הערכים התזונתיים.'
        );
        this.isAnalyzing.set(false);
      },
    });
  }

  onLabelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.isAnalyzing.set(true);
    this.errorMessage.set(null);
    this.analysis.set(null);

    this.mealsService.analyzeLabelImage(file).subscribe({
      next: (res) => {
        this.analysis.set(res.data.analysis);
        this.imagePath.set(res.data.image_path);
        this.isAnalyzing.set(false);
      },
      error: (err) => {
        this.errorMessage.set(
          err.error?.message || 'שגיאה בניתוח תווית המזון. אנא נסה שוב.'
        );
        this.isAnalyzing.set(false);
      },
    });
  }

  loadFavorites(): void {
    this.isLoadingFavorites.set(true);
    this.mealsService.getMeals(1, undefined, true).subscribe({
      next: (res: any) => {
        const data = res?.data || res;
        this.favoriteMeals.set(data?.meals || []);
        this.isLoadingFavorites.set(false);
      },
      error: () => {
        this.isLoadingFavorites.set(false);
      },
    });
  }

  logFavoriteMeal(meal: Meal): void {
    if (!meal.id) return;
    const targetDate = this.selectedDate();
    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.mealsService
      .cloneMeal(meal.id, {
        multiplier: this.selectedMultiplier(),
        meal_type: this.mealType(),
        date: targetDate || undefined,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          if (targetDate) {
            this.router.navigate(['/history'], { queryParams: { view: 'calendar', date: targetDate } });
          } else {
            this.router.navigate(['/dashboard']);
          }
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'שגיאה בהוספת הארוחה מהמועדפים.');
          this.isSaving.set(false);
        },
      });
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

    const targetDate = this.selectedDate();
    const todayStr = new Date().toISOString().split('T')[0];
    if (targetDate && targetDate > todayStr) {
      this.errorMessage.set('לא ניתן להוסיף ארוחה בתאריך עתידי.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    this.mealsService
      .saveMeal({
        title: result.title,
        meal_type: this.mealType(),
        image_path: this.imagePath() || undefined,
        input_method: this.inputMode() === 'image' ? 'image' : 'text',
        raw_input: this.inputMode() === 'text' ? this.textDescription() : undefined,
        is_favorite: this.saveAsFavorite(),
        ingredients: result.ingredients,
        date: targetDate || undefined,
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          if (targetDate) {
            this.router.navigate(['/history'], { queryParams: { view: 'calendar', date: targetDate } });
          } else {
            this.router.navigate(['/dashboard']);
          }
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
    this.applyIngredientGrams(index, newGrams);
  }

  adjustIngredientGrams(index: number, delta: number): void {
    const current = this.analysis();
    if (!current || !current.ingredients[index]) return;
    const currentGrams = current.ingredients[index].estimated_grams || 0;
    const nextGrams = Math.max(5, currentGrams + delta);
    this.applyIngredientGrams(index, nextGrams);
  }

  private applyIngredientGrams(index: number, newGrams: number): void {
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
  readonly isAddingIngredient = signal(false);
  readonly newIngredient = signal<Partial<Ingredient>>({
    name: '',
    category: 'other',
    estimated_grams: 100,
    calories: 0,
    protein_grams: 0,
    carbs_grams: 0,
    fat_grams: 0,
    fiber_grams: 0,
    sugar_grams: 0
  });

  saveNewIngredient(): void {
    const current = this.analysis();
    const ing = this.newIngredient();
    if (!current || !ing.name || ing.calories === undefined) return;
    
    const ingredientToAdd: Ingredient = {
      name: ing.name,
      category: ing.category || 'other',
      estimated_grams: ing.estimated_grams || 0,
      calories: ing.calories || 0,
      protein_grams: ing.protein_grams || 0,
      carbs_grams: ing.carbs_grams || 0,
      fat_grams: ing.fat_grams || 0,
      fiber_grams: ing.fiber_grams || 0,
      sugar_grams: ing.sugar_grams || 0
    };

    this.analysis.set({
      ...current,
      ingredients: [...current.ingredients, ingredientToAdd]
    });

    // Reset form
    this.isAddingIngredient.set(false);
    this.newIngredient.set({
      name: '',
      category: 'other',
      estimated_grams: 100,
      calories: 0,
      protein_grams: 0,
      carbs_grams: 0,
      fat_grams: 0,
      fiber_grams: 0,
      sugar_grams: 0
    });
  }

  cancelNewIngredient(): void {
    this.isAddingIngredient.set(false);
  }
}
