import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthAppService } from './services/auth-app.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthAppService, private router: Router) {}

  canActivate(): boolean {
    // ✅ Vérifie si l'utilisateur est connecté
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);  // ← Redirige vers /login
      return false;
    }

    // ✅ Autorise l'accès si connecté (peu importe le rôle)
    return true;
  }
}
