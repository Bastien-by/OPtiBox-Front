import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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

  private currentUserSubject = new BehaviorSubject<AppUser | null>(this.loadUserFromStorage());
  currentUser$ = this.currentUserSubject.asObservable();

  private sessionTTL = 300 * 60 * 1000;

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

  // ✅ AJOUTE CETTE MÉTHODE (mock local, sans HTTP)
  async authenticate(username: string, password: string): Promise<boolean> {
    // Liste des utilisateurs en dur
    const mockUsers = [
      { id: 1, username: 'admin', password: 'admin123', role: 'ADMIN' as const },
      { id: 2, username: 'operator', password: 'operator123', role: 'OPERATEUR' as const },
      { id: 3, username: 'maintenance', password: 'maintenance123', role: 'MAINTENANCE' as const }
    ];

    // Simule un délai réseau (optionnel)
    await new Promise(resolve => setTimeout(resolve, 500));

    const user = mockUsers.find(u => u.username === username && u.password === password);

    if (user) {
      // Login réussi → stocke l'utilisateur
      this.login({ id: user.id, username: user.username, role: user.role });
      return true;
    }

    // Identifiants incorrects
    return false;
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
