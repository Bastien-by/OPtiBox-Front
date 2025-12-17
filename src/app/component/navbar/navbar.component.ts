import {Component, OnInit, OnDestroy} from '@angular/core';
import {Router, RouterLink, RouterLinkActive} from "@angular/router";
import {KeycloakService} from "keycloak-angular";
import { CommonModule } from '@angular/common';
import {KeycloakProfile} from "keycloak-js";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {faHouse} from "@fortawesome/free-solid-svg-icons";
import {faBarcode} from "@fortawesome/free-solid-svg-icons";
import {faListCheck} from "@fortawesome/free-solid-svg-icons";
import {faClockRotateLeft} from "@fortawesome/free-solid-svg-icons";
import {faBox} from "@fortawesome/free-solid-svg-icons";
import {faList} from "@fortawesome/free-solid-svg-icons";
import {faBoxesStacked} from "@fortawesome/free-solid-svg-icons";
import {faPeopleGroup} from "@fortawesome/free-solid-svg-icons";
import {faSignOutAlt} from "@fortawesome/free-solid-svg-icons";
import {faCircleUser} from "@fortawesome/free-solid-svg-icons";
import { Html5Qrcode } from 'html5-qrcode';
import { firstValueFrom } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { AuthAppService } from '../../services/auth-app.service';
import { UserService } from '../../services/user.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    CommonModule,
    FaIconComponent,
    ToastModule
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
  providers: [MessageService]
})
export class NavbarComponent implements OnDestroy {

  badgeScannerVisible = false;
  private html5QrCodeBadge?: Html5Qrcode;
  private badgeScannerInitialized = false;

  constructor(
    private authApp: AuthAppService,
    private userService: UserService,
    private messageService: MessageService
  ) {}

  ngOnDestroy(): void {
    this.stopBadgeScanner();
  }

  /* ------- Auth OptiBox globale ------- */

  isLoggedIn(): boolean {
    return this.authApp.isLoggedIn();
  }

  isAdmin(): boolean {
    return this.authApp.isAdmin();
  }

  isMaintenance(): boolean {
    return this.authApp.isMaintenance();
  }

  isOperator(): boolean {
    return this.authApp.isOperator();
  }

  getUsername(): string {
    return this.authApp.getUsername();
  }

  logout(): void {
    const username = this.getUsername();
    this.authApp.logout();
    this.messageService.add({
      severity: 'error',
      summary: 'Déconnexion',
      detail: username ? `Au revoir, ${username}` : 'Vous êtes déconnecté'
    });
  }

  /* ------- Scan badge dans la navbar ------- */

  async toggleBadgeScanner(): Promise<void> {
    if (this.badgeScannerVisible) {
      this.badgeScannerVisible = false;
      await this.stopBadgeScanner();
    } else {
      this.badgeScannerVisible = true;
      setTimeout(() => this.startBadgeScanner(), 0);
    }
  }

  private async startBadgeScanner(): Promise<void> {
    if (this.badgeScannerInitialized) {
      return;
    }

    const elementId = 'qr-reader-badge';
    this.html5QrCodeBadge = new Html5Qrcode(elementId);

    try {
      await this.html5QrCodeBadge.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          // decodedText = token présent dans la colonne "token" de ta table user
          await this.loginWithBadge(decodedText);
          this.badgeScannerVisible = false;
          this.stopBadgeScanner();
        },
        () => {
          // erreurs de scan non bloquantes
        }
      );
      this.badgeScannerInitialized = true;
    } catch (err) {
      console.error('Erreur lors du démarrage du scanner badge navbar', err);
      this.badgeScannerVisible = false;
    }
  }

  private async stopBadgeScanner(): Promise<void> {
    if (this.html5QrCodeBadge && this.badgeScannerInitialized) {
      try {
        await this.html5QrCodeBadge.stop();
        await this.html5QrCodeBadge.clear();
      } catch (err) {
        console.error('Erreur à l’arrêt du scanner badge navbar', err);
      }
    }
    this.html5QrCodeBadge = undefined;
    this.badgeScannerInitialized = false;
  }

  private async loginWithBadge(badgeToken: string): Promise<void> {
    try {
      const user = await firstValueFrom(this.userService.getUserByBadge(badgeToken));

      if (!user) {
        this.messageService.add({
          severity: 'error',
          summary: 'Connexion',
          detail: 'Badge non reconnu'
        });
        return;
      }

      this.authApp.login({
        id: user.id,
        username: user.username,
        role: user.role
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Connexion',
        detail: `Bonjour, ${user.username}`
      });

    } catch (e) {
      console.error('Erreur lors de la connexion par badge', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Connexion',
        detail: 'Une erreur est survenue lors de la connexion'
      });
    }
  }
  protected readonly faHouse = faHouse;
  protected readonly faBarcode = faBarcode;
  protected readonly faListCheck = faListCheck;
  protected readonly faClockRotateLeft = faClockRotateLeft;
  protected readonly faBox = faBox;
  protected readonly faList = faList;
  protected readonly faBoxesStacked = faBoxesStacked;
  protected readonly faPeopleGroup = faPeopleGroup;
  protected readonly faSignOutAlt = faSignOutAlt;
  protected readonly faCircleUser = faCircleUser;
}
