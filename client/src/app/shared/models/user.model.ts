export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string;
  daily_calorie_goal: number;
  height_cm?: number | null;
  weight_kg?: number | null;
  gender?: 'male' | 'female' | null;
  age?: number | null;
  macro_protein_g?: number | null;
  macro_carbs_g?: number | null;
  macro_fat_g?: number | null;
  created_at: string;
}
