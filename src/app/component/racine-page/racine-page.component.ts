import {Component, OnInit} from '@angular/core';
import {Router, RouterModule} from "@angular/router";
import {KeycloakProfile} from "keycloak-js";
import {KeycloakService} from "keycloak-angular";
import {NgClass} from "@angular/common";
import {MessageService} from "primeng/api";
import {ToastModule} from "primeng/toast";

@Component({
  selector: 'app-racine-page',
  standalone: true,
  imports: [RouterModule, NgClass, ToastModule],
  templateUrl: './racine-page.component.html',
  providers: [MessageService],
  styleUrl: './racine-page.component.css'
})
export class RacinePageComponent implements OnInit {
  userProfile: KeycloakProfile | undefined;
  constructor(private keycloakService: KeycloakService, private messageService: MessageService, private router: Router) {}

  ngOnInit(): void {
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

  navigateOrShowToast(route: string, hasPermission: boolean) {
    if (hasPermission) {
      this.router.navigate([route]);
    } else {
      this.showErrorRoleToast();
    }
  }

  showErrorRoleToast(){
    console.log('Vous devez avoir un rôle admin pour accéder à cette page');
    this.messageService.add({ severity: 'error', summary: 'Accès non autorisé', detail: 'Vous devez avoir un rôle admin pour accéder à cette page' });
  }
}
