import { Component, EventEmitter, Input, Output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Meal, Ingredient, MealType } from '../../models/meal.model';
import { MealsService } from '../../../core/services/meals.service';

interface EditableIngredient extends Ingredient {
  original_grams: number;
  original_calories: number;
  original_protein: number;
  original_carbs: number;
  original_fat: number;
}

@Component({
  selector: 'app-edit-meal-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-meal-modal.html',
  styleUrl: './edit-meal-modal.css'
})
export class EditMealModal {
  @Input() set meal(value: Meal | null) {
    this._meal = value;
    if (value) {
      this.mealType.set(value.meal_type as MealType);
      
      const editableIngs = (value.ingredients || []).map(ing => ({
        ...ing,
        original_grams: ing.estimated_grams || 1,
        original_calories: ing.calories || 0,
        original_protein: ing.protein_grams || 0,
        original_carbs: ing.carbs_grams || 0,
        original_fat: ing.fat_grams || 0
      }));
      this.ingredients.set(editableIngs);
    }
  }
  
  _meal: Meal | null = null;
  @Input() isOpen = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Meal>();

  mealType = signal<MealType>('snack');
  ingredients = signal<EditableIngredient[]>([]);
  isSaving = signal(false);

  constructor(private mealsService: MealsService) {}

  onGramsChange(ing: EditableIngredient, newGrams: number) {
    if (newGrams < 0) newGrams = 0;
    
    // Update the ingredient in the array
    this.ingredients.update(ings => {
      const index = ings.findIndex(i => i.name === ing.name);
      if (index === -1) return ings;
      
      const target = ings[index];
      const ratio = target.original_grams > 0 ? (newGrams / target.original_grams) : 0;
      
      const updated = {
        ...target,
        estimated_grams: newGrams,
        calories: target.original_calories * ratio,
        protein_grams: target.original_protein * ratio,
        carbs_grams: target.original_carbs * ratio,
        fat_grams: target.original_fat * ratio
      };
      
      const newArray = [...ings];
      newArray[index] = updated;
      return newArray;
    });
  }

  save() {
    if (!this._meal?.id) return;
    
    this.isSaving.set(true);
    
    const updateData = {
      meal_type: this.mealType(),
      ingredients: this.ingredients().map(ing => ({
        name: ing.name,
        category: ing.category,
        estimated_grams: ing.estimated_grams,
        calories: ing.calories,
        protein_grams: ing.protein_grams,
        carbs_grams: ing.carbs_grams,
        fat_grams: ing.fat_grams,
        fiber_grams: ing.fiber_grams || 0,
        sugar_grams: ing.sugar_grams || 0
      }))
    };

    this.mealsService.updateMeal(this._meal.id, updateData).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.saved.emit(res.data);
        this.close.emit();
      },
      error: (err) => {
        console.error('Failed to update meal', err);
        this.isSaving.set(false);
      }
    });
  }
}
