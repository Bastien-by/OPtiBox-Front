import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  faHouse, faBarcode, faListCheck, faClockRotateLeft,
  faBox, faList, faBoxesStacked, faPeopleGroup,
  faSignOutAlt, faCircleUser, faSignInAlt, faDoorOpen
} from '@fortawesome/free-solid-svg-icons';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { AuthAppService } from '../../services/auth-app.service';
import { UserService } from '../../services/user.service';
import { ScanService } from '../../services/scan.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink, RouterLinkActive,
    CommonModule, FormsModule,
    FaIconComponent, ToastModule, DialogModule
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
  providers: [MessageService]
})
export class NavbarComponent implements OnInit, OnDestroy {

  // ── Login dialog ──────────────────────────────────────────────────────────
  loginDialogVisible = false;
  loginToken         = '';
  loginError         = '';
  loginLoading       = false;

  constructor(
    private authApp: AuthAppService,
    private userService: UserService,
    private scanService: ScanService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {}
  ngOnDestroy(): void {}

  // ── Auth ──────────────────────────────────────────────────────────────────

  isLoggedIn()    { return this.authApp.isLoggedIn(); }
  isAdmin()       { return this.authApp.isAdmin(); }
  isMaintenance() { return this.authApp.isMaintenance(); }
  isOperator()    { return this.authApp.isOperator(); }
  getUsername()   { return this.authApp.getUsername(); }

  // ── Login dialog ──────────────────────────────────────────────────────────

  openLoginDialog(): void {
    this.loginToken   = '';
    this.loginError   = '';
    this.loginLoading = false;
    this.loginDialogVisible = true;
  }

  async submitLogin(): Promise<void> {
    if (!this.loginToken.trim()) {
      this.loginError = 'Veuillez saisir votre identifiant.';
      return;
    }

    this.loginError   = '';
    this.loginLoading = true;

    try {
      const success = await this.authApp.authenticate(this.loginToken.trim());

      if (success) {
        this.loginDialogVisible = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Connexion réussie',
          detail: `Bienvenue, ${this.getUsername()} !`
        });
        this.router.navigate(['/racine']);
      } else {
        this.loginError = 'Identifiant non reconnu.';
      }
    } catch {
      this.loginError = 'Erreur de connexion. Réessayez.';
    } finally {
      this.loginLoading = false;
    }
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.submitLogin();
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  logout(): void {
    const username = this.getUsername();
    this.authApp.logout();
    this.messageService.add({
      severity: 'info',
      summary: 'Déconnexion',
      detail: username ? `Au revoir, ${username}` : 'Vous êtes déconnecté'
    });
    setTimeout(() => this.router.navigate(['/login']), 1500);
  }

  // ── Icônes ────────────────────────────────────────────────────────────────

  protected readonly faHouse           = faHouse;
  protected readonly faBarcode         = faBarcode;
  protected readonly faListCheck       = faListCheck;
  protected readonly faClockRotateLeft = faClockRotateLeft;
  protected readonly faBox             = faBox;
  protected readonly faList            = faList;
  protected readonly faBoxesStacked    = faBoxesStacked;
  protected readonly faPeopleGroup     = faPeopleGroup;
  protected readonly faSignOutAlt      = faSignOutAlt;
  protected readonly faCircleUser      = faCircleUser;
  protected readonly faSignInAlt       = faSignInAlt;
  protected readonly faDoorOpen        = faDoorOpen;
}
