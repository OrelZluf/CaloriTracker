import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Meal, MealAnalysis, Ingredient } from '../../shared/models/meal.model';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface MealsListResponse {
  success: boolean;
  data: {
    meals: Meal[];
    total: number;
    page: number;
    totalPages: number;
  };
}

@Injectable({ providedIn: 'root' })
export class MealsService {
  private http = inject(HttpClient);

  analyzeImage(file: File): Observable<ApiResponse<{ analysis: MealAnalysis; image_path: string }>> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<ApiResponse<{ analysis: MealAnalysis; image_path: string }>>(`${API_URL}/meals/analyze-image`, formData);
  }

  analyzeText(description: string): Observable<ApiResponse<{ analysis: MealAnalysis }>> {
    return this.http.post<ApiResponse<{ analysis: MealAnalysis }>>(`${API_URL}/meals/analyze-text`, { description });
  }

  saveMeal(meal: Partial<Meal>): Observable<ApiResponse<Meal>> {
    return this.http.post<ApiResponse<Meal>>(`${API_URL}/meals`, meal);
  }

  getMeals(page?: number, date?: string): Observable<MealsListResponse> {
    let params = new HttpParams();
    if (page) params = params.set('page', page.toString());
    if (date) params = params.set('date', date);
    return this.http.get<MealsListResponse>(`${API_URL}/meals`, { params });
  }

  getMeal(id: number): Observable<ApiResponse<Meal>> {
    return this.http.get<ApiResponse<Meal>>(`${API_URL}/meals/${id}`);
  }

  deleteMeal(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${API_URL}/meals/${id}`);
  }
}
