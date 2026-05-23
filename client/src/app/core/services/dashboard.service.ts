import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DailySummary, WeeklySummary, MonthlySummary } from '../../shared/models/dashboard.model';
import { environment } from '../../../environments/environment';

const API_URL = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);

  /**
   * קבלת סיכום יומי - ברירת מחדל: היום
   */
  getDailySummary(date?: string): Observable<DailySummary> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<DailySummary>(`${API_URL}/dashboard/daily`, { params }).pipe(
      catchError((error) => {
        console.error('שגיאה בטעינת סיכום יומי:', error);
        throw error;
      })
    );
  }

  /**
   * קבלת סיכום שבועי - ברירת מחדל: השבוע הנוכחי
   */
  getWeeklySummary(date?: string): Observable<WeeklySummary> {
    let params = new HttpParams();
    if (date) {
      params = params.set('date', date);
    }

    return this.http.get<WeeklySummary>(`${API_URL}/dashboard/weekly`, { params }).pipe(
      catchError((error) => {
        console.error('שגיאה בטעינת סיכום שבועי:', error);
        throw error;
      })
    );
  }

  /**
   * קבלת סיכום חודשי - ברירת מחדל: החודש הנוכחי
   */
  getMonthlySummary(month?: number, year?: number): Observable<MonthlySummary> {
    let params = new HttpParams();
    if (month !== undefined) {
      params = params.set('month', month.toString());
    }
    if (year !== undefined) {
      params = params.set('year', year.toString());
    }

    return this.http.get<MonthlySummary>(`${API_URL}/dashboard/monthly`, { params }).pipe(
      catchError((error) => {
        console.error('שגיאה בטעינת סיכום חודשי:', error);
        throw error;
      })
    );
  }
}
