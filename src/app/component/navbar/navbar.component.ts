import {Component, OnInit} from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from "@angular/router";
import {KeycloakService} from "keycloak-angular";
import { CommonModule } from '@angular/common';
import {KeycloakProfile} from "keycloak-js";

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    CommonModule
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {

  userProfile: KeycloakProfile | undefined;
  constructor(private keycloakService: KeycloakService, private router: Router) {}

  ngOnInit() {
    if (this.isLoggedIn()) {
      this.loadUserProfile();
    }
  }

  isLoggedIn(): boolean {
    return this.keycloakService.isLoggedIn();
  }

  loadUserProfile() {
    this.keycloakService.loadUserProfile().then(profile => {
      this.userProfile = profile;
    }).catch(error => {
      console.error('Error loading user profile', error);
    });
  }

  isAdmin(): boolean {
    return this.keycloakService.isUserInRole('admin');
  }

  getUsername(): string {
    if (this.userProfile) {
      return <string>this.userProfile.username;
    } else {
      return '';
    }
  }

  logout(): void {
    // Réinitialisation du profil utilisateur après la déconnexion
    this.userProfile = undefined;
    // clear token
    this.keycloakService.clearToken();
    // clear cache
    this.keycloakService.getKeycloakInstance().clearToken();
    // Déconnexion de l'utilisateur
    this.keycloakService.logout('http://localhost:4200');
  }
}
