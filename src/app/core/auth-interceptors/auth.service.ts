import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { API_BASE } from '../api-service/api.config';

export type AuthUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  token: string;
};

const TOKEN_KEY = 'taxseer_token';
const USER_KEY = 'taxseer_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly currentUser = signal<AuthUser | null>(this._loadUser());

  readonly isLoggedIn = computed(() => this.currentUser() !== null);
  readonly token = computed(() => this.currentUser()?.token ?? null);

  login(email: string, password: string): Observable<AuthUser> {
    return this.http
      .post<Record<string, unknown>>(`${API_BASE}/api/auth/login`, { email, password })
      .pipe(
        map((raw) => this._normalizeUser(raw)),
        tap((user) => this._persist(user))
      );
  }

  logout(): void {
    this._clearStorage();
    this.currentUser.set(null);
    void this.router.navigate(['/sign-in']);
  }

  private _normalizeUser(raw: Record<string, unknown>): AuthUser {
    const id = Number(raw['id']);
    const token = String(raw['token'] ?? raw['accessToken'] ?? '');

    if (!Number.isFinite(id) || id <= 0 || !token) {
      throw new Error('Invalid login response');
    }

    return {
      id,
      email: String(raw['email'] ?? ''),
      firstName: String(raw['firstName'] ?? ''),
      lastName: String(raw['lastName'] ?? ''),
      role: String(raw['role'] ?? ''),
      token,
    };
  }

  private _persist(user: AuthUser): void {
    if (this.isBrowser) {
      localStorage.setItem(TOKEN_KEY, user.token);
      const { token: _token, ...profile } = user;
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
    }
    this.currentUser.set(user);
  }

  private _clearStorage(): void {
    if (!this.isBrowser) {
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private _loadUser(): AuthUser | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const raw = localStorage.getItem(USER_KEY);
      if (!token || !raw) {
        return null;
      }

      const profile = JSON.parse(raw) as Omit<AuthUser, 'token'>;
      if (!profile?.id) {
        return null;
      }

      return { ...profile, token };
    } catch {
      return null;
    }
  }
}
