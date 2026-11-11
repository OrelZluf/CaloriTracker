import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface User {
  id: number;
  google_id?: string;
  email: string;
  name: string;
  avatar_url: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  gender?: 'male' | 'female';
  age?: number | null;
  daily_calorie_goal: number;
  macro_protein_g?: number | null;
  macro_carbs_g?: number | null;
  macro_fat_g?: number | null;
  water_glass_ml?: number | null;
  water_bottle_ml?: number | null;
  created_at: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

interface UserResponse {
  success: boolean;
  data: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly API_URL = `${environment.apiUrl}/auth`;

  private readonly _user = signal<User | null>(null);
  private readonly _token = signal<string | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly username = computed(() => this._user()?.name ?? '');

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const token = localStorage.getItem('ct_token');
      const userJson = localStorage.getItem('ct_user');
      if (token && userJson) {
        this._token.set(token);
        this._user.set(JSON.parse(userJson));
      }
    } catch {
      this.clearStorage();
    }
  }

  private saveToStorage(token: string, user: User): void {
    try {
      localStorage.setItem('ct_token', token);
      localStorage.setItem('ct_user', JSON.stringify(user));
    } catch (err) {
      console.warn('Could not persist auth session to localStorage (storage quota may be full):', err);
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem('ct_token');
      localStorage.removeItem('ct_user');
    } catch {
      // Ignore storage errors
    }
  }

  getToken(): string | null {
    return this._token();
  }

  loginWithGoogle(
    idToken: string,
    callbacks?: { onSuccess?: () => void; onError?: (msg: string) => void }
  ): void {
    this._loading.set(true);
    this._error.set(null);
    this.http.post<AuthResponse>(`${this.API_URL}/google`, { idToken }).subscribe({
      next: (res) => {
        this._loading.set(false);
        if (res.success && res.data) {
          this._token.set(res.data.token);
          this._user.set(res.data.user);
          this.saveToStorage(res.data.token, res.data.user);
          callbacks?.onSuccess?.();
          this.router.navigate(['/dashboard']);
        } else {
          const msg = res.message || 'ההזדהות עם Google נכשלה. אנא נסה שוב.';
          this._error.set(msg);
          callbacks?.onError?.(msg);
        }
      },
      error: (err) => {
        this._loading.set(false);
        const msg =
          err?.error?.message ||
          (err?.status === 0
            ? 'לא ניתן להתחבר לשרת. ודא שהשרת פועל.'
            : 'ההזדהות עם Google נכשלה. אנא נסה שוב.');
        this._error.set(msg);
        callbacks?.onError?.(msg);
      }
    });
  }



  fetchProfile(): void {
    this.http.get<UserResponse>(`${this.API_URL}/me`).subscribe({
      next: (res) => {
        if (res.success) {
          this._user.set(res.data);
          try {
            localStorage.setItem('ct_user', JSON.stringify(res.data));
          } catch {
            // Ignore storage quota errors
          }
        }
      }
    });
  }

  updateProfile(data: Partial<User>) {
    return this.http.put<UserResponse>(`${this.API_URL}/profile`, data);
  }

  logout(): void {
    this._user.set(null);
    this._token.set(null);
    this.clearStorage();
    this.router.navigate(['/login']);
  }
}
