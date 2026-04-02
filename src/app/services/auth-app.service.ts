import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

export interface AppUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'MAINTENANCE' | 'OPERATEUR';
  token?: string;
}

interface StoredUser {
  value: AppUser;
  expiry: number;
}

const STORAGE_KEY = 'optibox_user';

@Injectable({
  providedIn: 'root'
})
export class AuthAppService {

  private currentUserSubject = new BehaviorSubject<AppUser | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  private sessionTTL =  10 * 60 * 1000;
  private logoutTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private httpClient: HttpClient) {
    this.restoreSession();
  }

  // ── Initialisation session ────────────────────────────────────────────────

  private restoreSession(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.currentUserSubject.next(null);
      return;
    }

    try {
      const stored: StoredUser = JSON.parse(raw);

      if (Date.now() > stored.expiry) {
        localStorage.removeItem(STORAGE_KEY);
        this.currentUserSubject.next(null);
        return;
      }

      this.currentUserSubject.next(stored.value);
      this.startLogoutTimer(stored.expiry);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      this.currentUserSubject.next(null);
    }
  }

  private saveUserToStorage(user: AppUser): void {
    const expiry = Date.now() + this.sessionTTL;
    const stored: StoredUser = {
      value: user,
      expiry
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    this.startLogoutTimer(expiry);
  }

  private startLogoutTimer(expiry: number): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
    }

    const remaining = expiry - Date.now();
    console.log('expiry =', expiry);
    console.log('now =', Date.now());
    console.log('remaining =', remaining);

    if (remaining <= 0) {
      this.handleAutoLogout();
      return;
    }

    this.logoutTimer = setTimeout(() => {
      console.log('AUTO LOGOUT déclenché');
      this.handleAutoLogout();
    }, remaining);
  }

  private handleAutoLogout(): void {
    this.logout(false);
    alert('Votre session a expiré. Vous allez être déconnecté.');
    window.location.reload();
  }

  // ── Authentification ──────────────────────────────────────────────────────

  async authenticate(token: string): Promise<boolean> {
    try {
      const users = await firstValueFrom(
        this.httpClient.get<AppUser[]>('api/users')
      );

      const found = users.find(u => u.token === token.trim());

      if (found) {
        this.login(found);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Erreur authentification:', err);
      return false;
    }
  }

  // ── Session ───────────────────────────────────────────────────────────────

  login(user: AppUser): void {
    this.saveUserToStorage(user);
    this.currentUserSubject.next(user);
  }

  logout(reload: boolean = true): void {
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }

    localStorage.removeItem(STORAGE_KEY);
    this.currentUserSubject.next(null);

    if (reload) {
      window.location.reload();
    }
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  getCurrentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'ADMIN';
  }

  isMaintenance(): boolean {
    return this.getCurrentUser()?.role === 'MAINTENANCE';
  }

  isOperator(): boolean {
    return this.getCurrentUser()?.role === 'OPERATEUR';
  }

  getUsername(): string {
    return this.getCurrentUser()?.username ?? '';
  }
}
