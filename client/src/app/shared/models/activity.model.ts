export interface Activity {
  id?: number;
  user_id?: number;
  title: string;
  activity_type: string;
  duration_minutes: number;
  calories_burned: number;
  met_value: number;
  input_method: 'manual' | 'text';
  raw_input?: string;
  created_at?: string;
}

export interface ActivityAnalysis {
  title: string;
  activities: {
    activity_type: string;
    duration_minutes: number;
    met_value: number;
  }[];
}

export const COMMON_ACTIVITIES = [
  { id: 'walking', name: 'הליכה קלה', icon: '🚶', met: 3.0 },
  { id: 'walking_fast', name: 'הליכה מהירה', icon: '🚶‍♂️', met: 4.3 },
  { id: 'running', name: 'ריצה', icon: '🏃', met: 9.8 },
  { id: 'cycling', name: 'רכיבה על אופניים', icon: '🚴', met: 7.5 },
  { id: 'swimming', name: 'שחייה', icon: '🏊', met: 6.0 },
  { id: 'weights', name: 'אימון משקולות', icon: '🏋️', met: 6.0 },
  { id: 'yoga', name: 'יוגה/פילאטיס', icon: '🧘', met: 3.0 },
  { id: 'soccer', name: 'כדורגל', icon: '⚽', met: 7.0 },
  { id: 'basketball', name: 'כדורסל', icon: '🏀', met: 6.5 },
  { id: 'tennis', name: 'טניס', icon: '🎾', met: 7.3 }
];
