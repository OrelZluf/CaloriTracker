import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MealType } from '../../shared/models/meal.model';
import { LocalCacheService } from './local-cache.service';
import { toLocalDateStr } from './view-date.service';

export interface AdvisorMealSuggestion {
  title: string;
  meal_type: MealType;
  calories: number;
  protein_grams: number;
  carbs_grams: number;
  fat_grams: number;
  why: string;
}

export interface AdvisorBudget {
  date: string;
  calorie_goal: number;
  consumed_calories: number;
  burned_calories: number;
  remaining_calories: number;
  remaining_protein: number;
  remaining_carbs: number;
  remaining_fat: number;
}

export interface AdvisorChatTurn {
  role: 'user' | 'assistant';
  text: string;
  suggestions?: AdvisorMealSuggestion[];
}

export interface AdvisorChatResponse {
  success: boolean;
  data: {
    reply: string;
    suggestions: AdvisorMealSuggestion[];
    budget: AdvisorBudget;
  };
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AdvisorService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalCacheService);
  private readonly apiUrl = `${environment.apiUrl}/advisor`;

  private chatKey(date?: string): string {
    return `advisor_chat_${date || toLocalDateStr()}`;
  }

  getCachedChatHistory(date?: string): AdvisorChatTurn[] {
    return this.cache.get<AdvisorChatTurn[]>(this.chatKey(date), 24 * 60 * 60 * 1000) || [];
  }

  saveCachedChatHistory(date: string, turns: AdvisorChatTurn[]): void {
    this.cache.set(this.chatKey(date || toLocalDateStr()), turns);
  }

  sendMessage(
    message: string,
    date: string,
    history: { role: 'user' | 'assistant'; text: string }[] = []
  ): Observable<AdvisorChatResponse> {
    return this.http.post<AdvisorChatResponse>(`${this.apiUrl}/chat`, {
      message,
      date,
      history
    });
  }
}
