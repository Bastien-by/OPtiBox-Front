import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { DatePipe, NgClass, NgIf } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  faBarcode,
  faBox,
  faBoxesStacked,
  faClockRotateLeft,
  faListCheck,
  faPeopleGroup,
  faList
} from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { StockService } from '../../services/stock.service';
import { CheckService } from '../../services/check.service';
import { AuthAppService } from '../../services/auth-app.service';

@Component({
  selector: 'app-racine-page',
  standalone: true,
  imports: [RouterModule, NgClass, ToastModule, FaIconComponent, DatePipe, NgIf],
  templateUrl: './racine-page.component.html',
  providers: [MessageService],
  styleUrls: ['./racine-page.component.css']
})
export class RacinePageComponent implements OnInit {

  nbStocksOK = 0;
  nbStocksNOK = 0;
  nbStocksHS = 0;

  lastCheck: any = {
    date: null,
    status: null
  };

  constructor(
    private messageService: MessageService,
    private stockService: StockService,
    private checkService: CheckService,
    private router: Router,
    private authApp: AuthAppService
  ) {}

  async ngOnInit(): Promise<void> {
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

  navigateOrShowToast(route: string, hasPermission: boolean) {
    if (hasPermission) {
      this.router.navigate([route]);
    } else {
      this.showErrorRoleToast();
    }
  }

  showErrorRoleToast() {
    this.messageService.add({
      severity: 'error',
      summary: 'Accès non autorisé',
      detail: 'Vous devez avoir un rôle admin pour accéder à cette page'
    });
  }

  protected readonly faBarcode = faBarcode;
  protected readonly faListCheck = faListCheck;
  protected readonly faClockRotateLeft = faClockRotateLeft;
  protected readonly faBox = faBox;
  protected readonly faBoxesStacked = faBoxesStacked;
  protected readonly faPeopleGroup = faPeopleGroup;
  protected readonly faList = faList;
}
