import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Meal, MealAnalysis, Ingredient } from '../../shared/models/meal.model';
import { environment } from '../../../environments/environment';
import { LocalCacheService } from './local-cache.service';

const API_URL = environment.apiUrl;
const FAVORITES_KEY = 'favorites_list';
const FAVORITES_TTL_MS = 24 * 60 * 60 * 1000;

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
  private readonly http = inject(HttpClient);
  private readonly cache = inject(LocalCacheService);

  getCachedFavorites(): Meal[] | null {
    return this.cache.get<Meal[]>(FAVORITES_KEY, FAVORITES_TTL_MS);
  }

  private invalidateMealSummaries(alsoFavorites = false): void {
    const prefixes = ['daily_', 'weekly_', 'monthly_', 'insight_'];
    if (alsoFavorites) {
      prefixes.push(FAVORITES_KEY);
    }
    this.cache.invalidatePrefixes(prefixes);
  }

  analyzeImage(file: File): Observable<ApiResponse<{ analysis: MealAnalysis; image_path: string }>> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<ApiResponse<{ analysis: MealAnalysis; image_path: string }>>(`${API_URL}/meals/analyze-image`, formData);
  }

  analyzeText(description: string): Observable<ApiResponse<{ analysis: MealAnalysis }>> {
    return this.http.post<ApiResponse<{ analysis: MealAnalysis }>>(`${API_URL}/meals/analyze-text`, { description });
  }

  lookupBarcode(code: string): Observable<ApiResponse<{ analysis: MealAnalysis }>> {
    return this.http.get<ApiResponse<{ analysis: MealAnalysis }>>(`${API_URL}/meals/barcode/${encodeURIComponent(code.trim())}`);
  }

  analyzeLabelImage(file: File): Observable<ApiResponse<{ analysis: MealAnalysis; image_path: string }>> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<ApiResponse<{ analysis: MealAnalysis; image_path: string }>>(`${API_URL}/meals/analyze-label`, formData);
  }

  saveMeal(meal: Partial<Meal>): Observable<ApiResponse<Meal>> {
    return this.http.post<ApiResponse<Meal>>(`${API_URL}/meals`, meal).pipe(
      tap(() => this.invalidateMealSummaries(Boolean(meal.is_favorite)))
    );
  }

  getMeals(page?: number, date?: string, favorite?: boolean): Observable<MealsListResponse> {
    let params = new HttpParams();
    if (page) params = params.set('page', page.toString());
    if (date) params = params.set('date', date);
    if (favorite) params = params.set('favorite', 'true');
    return this.http.get<MealsListResponse>(`${API_URL}/meals`, { params }).pipe(
      tap(res => {
        if (favorite && (!page || page === 1) && !date && res?.data?.meals) {
          this.cache.set(FAVORITES_KEY, res.data.meals);
        }
      })
    );
  }

  getMeal(id: number): Observable<ApiResponse<Meal>> {
    return this.http.get<ApiResponse<Meal>>(`${API_URL}/meals/${id}`);
  }

  updateMeal(id: string | number, updateData: { title?: string; meal_type: string; ingredients: Ingredient[]; is_favorite?: boolean }): Observable<ApiResponse<Meal>> {
    return this.http.put<ApiResponse<Meal>>(`${API_URL}/meals/${id}`, updateData).pipe(
      tap(() => this.invalidateMealSummaries(true))
    );
  }

  toggleFavorite(id: string | number, isFavorite?: boolean): Observable<ApiResponse<Meal>> {
    const body = typeof isFavorite === 'boolean' ? { is_favorite: isFavorite } : {};
    return this.http.put<ApiResponse<Meal>>(`${API_URL}/meals/${id}/favorite`, body).pipe(
      tap(() => this.cache.remove(FAVORITES_KEY))
    );
  }

  cloneMeal(id: string | number, options?: { multiplier?: number; meal_type?: string; date?: string }): Observable<ApiResponse<Meal>> {
    return this.http.post<ApiResponse<Meal>>(`${API_URL}/meals/${id}/clone`, options || {}).pipe(
      tap(() => this.invalidateMealSummaries(false))
    );
  }

  deleteMeal(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${API_URL}/meals/${id}`).pipe(
      tap(() => this.invalidateMealSummaries(true))
    );
  }
}
