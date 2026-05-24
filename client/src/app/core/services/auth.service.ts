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

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());
  readonly username = computed(() => this._user()?.name ?? '');

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('ct_token');
    const userJson = localStorage.getItem('ct_user');
    if (token && userJson) {
      try {
        this._token.set(token);
        this._user.set(JSON.parse(userJson));
      } catch {
        this.clearStorage();
      }
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_user');
  }

  getToken(): string | null {
    return this._token();
  }

  loginWithGoogle(idToken: string): void {
    this._loading.set(true);
    this.http.post<AuthResponse>(`${this.API_URL}/google`, { idToken }).subscribe({
      next: (res) => {
        if (res.success) {
          this._token.set(res.data.token);
          this._user.set(res.data.user);
          localStorage.setItem('ct_token', res.data.token);
          localStorage.setItem('ct_user', JSON.stringify(res.data.user));
          this.router.navigate(['/dashboard']);
        }
        this._loading.set(false);
      },
      error: () => {
        this._loading.set(false);
      }
    });
  }



  fetchProfile(): void {
    this.http.get<UserResponse>(`${this.API_URL}/me`).subscribe({
      next: (res) => {
        if (res.success) {
          this._user.set(res.data);
          localStorage.setItem('ct_user', JSON.stringify(res.data));
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
