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
  date?: string;
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
  { id: 'yoga', name: 'יוגה', icon: '🧘', met: 2.5 },
  { id: 'pilates', name: 'פילאטיס', icon: '🤸‍♀️', met: 3.0 },
  { id: 'jump_rope', name: 'קפיצה בחבל', icon: '🪢', met: 11.0 },
  { id: 'hiit', name: 'אימון HIIT', icon: '⚡', met: 8.0 },
  { id: 'crossfit', name: 'קרוספיט', icon: '🏋️‍♂️', met: 8.0 },
  { id: 'spinning', name: 'ספינינג', icon: '🚴‍♀️', met: 8.5 },
  { id: 'dance', name: 'ריקוד/זומבה', icon: '💃', met: 6.5 },
  { id: 'hiking', name: 'טיול רגלי', icon: '🥾', met: 6.0 },
  { id: 'elliptical', name: 'אליפטיקל', icon: '🏃‍♀️', met: 5.0 },
  { id: 'rowing', name: 'חתירה', icon: '🚣', met: 7.0 },
  { id: 'boxing', name: 'אגרוף', icon: '🥊', met: 7.8 },
  { id: 'martial_arts', name: 'אומנויות לחימה', icon: '🥋', met: 10.0 },
  { id: 'stretching', name: 'מתיחות', icon: '🙆', met: 2.3 },
  { id: 'soccer', name: 'כדורגל', icon: '⚽', met: 7.0 },
  { id: 'basketball', name: 'כדורסל', icon: '🏀', met: 6.5 },
  { id: 'tennis', name: 'טניס', icon: '🎾', met: 7.3 },
  { id: 'volleyball', name: 'כדורעף', icon: '🏐', met: 4.0 }
];
