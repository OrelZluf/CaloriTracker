export interface DailySummary {
  date: string;
  total_calories: number;
  total_calories_burned?: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meals: {
    id: number;
    title: string;
    meal_type: string;
    total_calories: number;
    created_at: string;
  }[];
  activities?: {
    id: number;
    name: string;
    calories_burned: number;
    duration_minutes: number;
  }[];
  calorie_goal: number;
}

export interface WeeklySummary {
  start_date: string;
  end_date: string;
  days: DailySummary[];
  average_calories: number;
  total_calories: number;
}

export interface MonthlySummary {
  month: number;
  year: number;
  days: DailySummary[];
  average_calories: number;
  total_calories: number;
}
