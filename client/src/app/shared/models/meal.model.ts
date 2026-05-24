export interface Ingredient {
  id?: number;
  meal_id?: number;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'other';
  estimated_grams: number;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  fiber_grams: number;
  sugar_grams: number;
}

export interface Meal {
  id?: number;
  user_id?: number;
  title: string;
  image_path?: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  input_method: 'image' | 'text';
  raw_input?: string;
  created_at?: string;
  ingredients?: Ingredient[];
}

export interface MealAnalysis {
  title: string;
  ingredients: Ingredient[];
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  dinner: 'ארוחת ערב',
  snack: 'ארוחת ביניים',
  other: 'אחר'
};

export const CATEGORY_LABELS: Record<string, string> = {
  protein: 'חלבון',
  carb: 'פחמימה',
  fat: 'שומן',
  vegetable: 'ירק',
  fruit: 'פרי',
  dairy: 'חלבי',
  other: 'אחר'
};

export const CATEGORY_ICONS: Record<string, string> = {
  protein: '🥩',
  carb: '🍞',
  fat: '🧈',
  vegetable: '🥦',
  fruit: '🍎',
  dairy: '🧀',
  other: '🍽️'
};
