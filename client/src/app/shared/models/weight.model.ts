export interface WeightLog {
  id?: string | number;
  user_id?: string | number;
  weight_kg: number;
  date: string;
  note?: string | null;
  created_at?: string;
}

export interface WeightCoachSummary {
  is_calibrated: boolean;
  start_weight: number | null;
  current_weight: number | null;
  weight_change_kg: number;
  span_days: number;
  avg_daily_calories: number | null;
  estimated_tdee: number;
  recommended_goal: number;
  current_goal: number;
  target_mode: 'lose' | 'gain' | 'maintain';
  message: string;
}

export interface WeightDataResponse {
  logs: WeightLog[];
  coach: WeightCoachSummary;
}
