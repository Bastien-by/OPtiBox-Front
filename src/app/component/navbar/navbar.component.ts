import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from "@angular/router";
import { CommonModule } from '@angular/common';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faHouse } from "@fortawesome/free-solid-svg-icons";
import { faBarcode } from "@fortawesome/free-solid-svg-icons";
import { faListCheck } from "@fortawesome/free-solid-svg-icons";
import { faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import { faBox } from "@fortawesome/free-solid-svg-icons";
import { faList } from "@fortawesome/free-solid-svg-icons";
import { faBoxesStacked } from "@fortawesome/free-solid-svg-icons";
import { faPeopleGroup } from "@fortawesome/free-solid-svg-icons";
import { faSignOutAlt } from "@fortawesome/free-solid-svg-icons";
import { faCircleUser } from "@fortawesome/free-solid-svg-icons";
import { faDoorOpen } from "@fortawesome/free-solid-svg-icons";
import { faSignInAlt  } from "@fortawesome/free-solid-svg-icons";
import { firstValueFrom, Subscription } from 'rxjs';
import { ToastModule } from 'primeng/toast';
import { AuthAppService } from '../../services/auth-app.service';
import { UserService } from '../../services/user.service';
import { ScanService } from '../../services/scan.service';
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
export class NavbarComponent implements OnInit, OnDestroy {

  private scanSubscription?: Subscription;
  private scanLocked = false;

  constructor(
    private authApp: AuthAppService,
    private userService: UserService,
    private scanService: ScanService,
    private messageService: MessageService,
    private router: Router
  ) {}

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
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
    // ✅ Redirige vers login
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 1500);  // 1.5s pour lire le toast
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
  protected readonly faSignInAlt  = faSignInAlt ;
}
