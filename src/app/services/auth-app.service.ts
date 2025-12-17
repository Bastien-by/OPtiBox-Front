import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AppUser {
  id: number;
  username: string;
  role: 'ADMIN' | 'MAINTENANCE' | 'OPERATEUR';
  token?: string;      // si tu en as un côté backend
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

  // utilisateur courant en mémoire
  private currentUserSubject = new BehaviorSubject<AppUser | null>(this.loadUserFromStorage());
  currentUser$ = this.currentUserSubject.asObservable();

  /** Durée de session OptiBox en ms (ex: 5min) */
  private sessionTTL = 5 * 60 * 1000;

  private loadUserFromStorage(): AppUser | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const stored: StoredUser = JSON.parse(raw);
      const now = Date.now();
      if (now > stored.expiry) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return stored.value;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private saveUserToStorage(user: AppUser): void {
    const stored: StoredUser = {
      value: user,
      expiry: Date.now() + this.sessionTTL
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }

  login(user: AppUser): void {
    this.saveUserToStorage(user);
    this.currentUserSubject.next(user);
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): AppUser | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  isAdmin(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.role === 'ADMIN';
  }

  isMaintenance(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.role === 'MAINTENANCE';
  }

  isOperator(): boolean {
    const user = this.getCurrentUser();
    return !!user && user.role === 'OPERATEUR';
  }

  getUsername(): string {
    return this.getCurrentUser()?.username ?? '';
  }
}
