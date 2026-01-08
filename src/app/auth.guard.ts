import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthAppService } from './services/auth-app.service';  // Ajuste le chemin (ex: src/app/services/)

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthAppService, private router: Router) {}

  canActivate(): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/racine']);
      return false;
    }

    // Protège les pages ADMIN uniquement
    if (this.authService.isAdmin()) {
      return true;
    }

    alert("Accès réservé aux administrateurs");
    this.router.navigate(['/racine']);
    return false;
  }
}
