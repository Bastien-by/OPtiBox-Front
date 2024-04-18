import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private keycloakService: KeycloakService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (!this.keycloakService.isLoggedIn()) {
      this.keycloakService.login();
      return false;
    }

    const requiredRole = 'admin'; // rôle autorisé à accéder aux pages

    if (this.keycloakService.isUserInRole(requiredRole)) {
      return true; // L'utilisateur a le rôle nécessaire pour accéder à la page
    } else {
      this.router.navigate(['/']); // Redirige vers la page d'accueil si l'utilisateur n'a pas les autorisations nécessaires
      return false;
    }
  }
}
