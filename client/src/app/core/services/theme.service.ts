import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'ct_theme';
  readonly theme = signal<AppTheme>(this.loadInitialTheme());

  constructor() {
    this.applyTheme(this.theme());
  }

  private loadInitialTheme(): AppTheme {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'dark';
  }

  toggleTheme(): void {
    const next: AppTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  setTheme(next: AppTheme): void {
    this.theme.set(next);
    try {
      localStorage.setItem(this.STORAGE_KEY, next);
    } catch {
      // Ignore storage access errors
    }
    this.applyTheme(next);
  }

  private applyTheme(theme: AppTheme): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }
}
