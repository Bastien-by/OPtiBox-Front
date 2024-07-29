import {Component, OnInit} from '@angular/core';
import {Router, RouterModule} from "@angular/router";
import {KeycloakProfile} from "keycloak-js";
import {KeycloakService} from "keycloak-angular";
import {DatePipe, NgClass, NgIf} from "@angular/common";
import {MessageService} from "primeng/api";
import {ToastModule} from "primeng/toast";
import {
  faBarcode,
  faBox,
  faBoxesStacked,
  faClockRotateLeft,
  faListCheck,
  faPeopleGroup
} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {StockService} from "../../services/stock.service";
import {CheckService} from "../../services/check.service";

@Component({
  selector: 'app-racine-page',
  standalone: true,
  imports: [RouterModule, NgClass, ToastModule, FaIconComponent, DatePipe, NgIf],
  templateUrl: './racine-page.component.html',
  providers: [MessageService],
  styleUrl: './racine-page.component.css'
})
export class RacinePageComponent implements OnInit {
  userProfile: KeycloakProfile | undefined;
  nbStocksOK: number = 0;
  nbStocksNOK: number = 0;
  nbStocksHS: number = 0;
  lastCheck: any = {
    date: null,
    status: null,
  };
  constructor(private keycloakService: KeycloakService, private messageService: MessageService, private stockService: StockService,  private checkService: CheckService, private router: Router) {}

  async ngOnInit(): Promise<void>{
    if (this.isLoggedIn()) {
      this.loadUserProfile();
    }

    await this.stockService.refreshStocks();
    this.updateStockCounts();

    await this.checkService.getChecks();
    this.lastCheck = this.checkService.getLastCheck();
  }

  updateStockCounts() {
    this.nbStocksOK = 0;
    this.nbStocksNOK = 0;
    this.nbStocksHS = 0;
    this.stockService.getAllStocks().forEach(stock => {
      if (stock.status === 1) {
        this.nbStocksOK++;
      } else if (stock.status === 0) {
        this.nbStocksNOK++;
      } else if (stock.status === 2) {
        this.nbStocksHS++;
      }
    });
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

    protected readonly faBarcode = faBarcode;
  protected readonly faListCheck = faListCheck;
  protected readonly faClockRotateLeft = faClockRotateLeft;
  protected readonly faBox = faBox;
  protected readonly faBoxesStacked = faBoxesStacked;
  protected readonly faPeopleGroup = faPeopleGroup;
}
