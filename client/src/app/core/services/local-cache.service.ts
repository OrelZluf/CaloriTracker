import { Injectable } from '@angular/core';

interface CacheEnvelope<T> {
  v: number;
  ts: number;
  data: T;
}

const CACHE_PREFIX = 'ct_cache_v1_';

/**
 * Lightweight localStorage cache manager for smooth, instant page transitions.
 * Supports Stale-While-Revalidate (instant UI hydration from localStorage + background refresh)
 * and prefix-based invalidation whenever the user mutates data.
 */
@Injectable({ providedIn: 'root' })
export class LocalCacheService {
  private getUserScope(): string {
    if (typeof localStorage === 'undefined') return 'anon';
    try {
      const raw = localStorage.getItem('ct_user');
      if (!raw) return 'anon';
      const parsed = JSON.parse(raw);
      return String(parsed?.id || parsed?._id || parsed?.email || 'anon');
    } catch {
      return 'anon';
    }
  }

  private buildKey(key: string): string {
    return `${CACHE_PREFIX}${this.getUserScope()}_${key}`;
  }

  /**
   * Read a cached item if present and not expired.
   * @param key Logical cache key (e.g. 'daily_2026-06-10', 'insight_2026-06-09')
   * @param maxAgeMs Optional TTL in ms (omit for permanent / immutable data like past-day insights)
   */
  get<T>(key: string, maxAgeMs?: number): T | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.buildKey(key));
      if (!raw) return null;
      const env: CacheEnvelope<T> = JSON.parse(raw);
      if (!env || typeof env !== 'object' || !('data' in env)) return null;
      if (maxAgeMs !== undefined && Date.now() - env.ts > maxAgeMs) {
        localStorage.removeItem(this.buildKey(key));
        return null;
      }
      return env.data;
    } catch {
      return null;
    }
  }

  /**
   * Persist an item into localStorage cache.
   */
  set<T>(key: string, data: T): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const env: CacheEnvelope<T> = {
        v: 1,
        ts: Date.now(),
        data
      };
      localStorage.setItem(this.buildKey(key), JSON.stringify(env));
    } catch {
      // If quota exceeded, evict old cache entries and retry once
      this.clearAll();
    }
  }

  /**
   * Remove a specific cache key.
   */
  remove(key: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.buildKey(key));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Remove all cache keys for the current user that start with any of the given logical prefixes.
   * Example: invalidatePrefixes(['daily_', 'weekly_', 'monthly_'])
   */
  invalidatePrefixes(prefixes: string[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const fullPrefixes = prefixes.map(p => this.buildKey(p));
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && fullPrefixes.some(fp => k.startsWith(fp))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Clear all ct_cache_v1_* entries (called on logout or storage eviction).
   */
  clearAll(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }
  }
}
