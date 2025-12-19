import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faDoorOpen, faDoorClosed, faHouse } from '@fortawesome/free-solid-svg-icons';
import { ScanService } from '../../services/scan.service';
import { StockService } from '../../services/stock.service';
import { AuthAppService } from '../../services/auth-app.service';

interface Locker {
  number: number;
  hasStock: boolean;
  stocksCount: number;
  tools: string[];
}

@Component({
  selector: 'app-open-locker',
  standalone: true,
  imports: [CommonModule, ToastModule, FaIconComponent],
  templateUrl: './openlocker.component.html',
  styleUrls: ['./openlocker.component.css'],
  providers: [MessageService]
})
export class OpenLockerComponent implements OnInit, OnDestroy {

  lockers: Locker[] = [];
  lockersMap: { [num: number]: Locker } = {};

  stats = { available: 0, empty: 0, total: 24 };
  recentActions: { action: string; locker: number; time: Date }[] = [];
  private actionTimeout: any;

  protected readonly faDoorOpen = faDoorOpen;
  protected readonly faDoorClosed = faDoorClosed;
  protected readonly faHouse = faHouse;

  constructor(
    private scanService: ScanService,
    private stockService: StockService,
    private authApp: AuthAppService,
    private messageService: MessageService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadLockers();
  }

  ngOnDestroy(): void {
    if (this.actionTimeout) {
      clearTimeout(this.actionTimeout);
    }
  }

  isLoggedIn(): boolean {
    return this.authApp.isLoggedIn();
  }

  isAdmin(): boolean {
    return this.authApp.isAdmin();
  }

  private async loadLockers(): Promise<void> {
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();

    const allStocks = [
      ...this.scanService.getAvailableStocks(),
      ...this.scanService.getLoanedStocks()
    ];

    this.lockers = [];
    this.lockersMap = {};

    for (let n = 1; n <= 24; n++) {
      const lockerStocks = allStocks.filter(s => s.lockerNumber === n);

      const locker: Locker = {
        number: n,
        hasStock: lockerStocks.length > 0,
        stocksCount: lockerStocks.length,
        tools: lockerStocks.map(s => s.alitracer)
      };

      this.lockers.push(locker);
      this.lockersMap[n] = locker;
    }

    this.stats = {
      available: this.lockers.filter(l => l.hasStock).length,
      empty: this.lockers.filter(l => !l.hasStock).length,
      total: 24
    };
  }

  async openLocker(lockerNumber: number): Promise<void> {
    try {
      await this.scanService.openLocker(lockerNumber);

      this.addRecentAction('Ouverture', lockerNumber);

      this.messageService.add({
        severity: 'success',
        summary: `Casier ${lockerNumber}`,
        detail: `Casier ${lockerNumber} ouvert avec succès`
      });

      setTimeout(() => this.loadLockers(), 2000);
    } catch (error: any) {
      console.error('Erreur ouverture casier:', error);
      this.messageService.add({
        severity: 'error',
        summary: `Casier ${lockerNumber}`,
        detail: `Erreur: ${error?.message || 'Impossible d\'ouvrir le casier'}`
      });
    }
  }

  async openAllLockers(): Promise<void> {
    try {
      for (let i = 1; i <= 24; i++) {
        try {
          await this.scanService.openLocker(i);
          this.addRecentAction('Ouverture', i);
        } catch (e) {
          console.warn(`Casier ${i} ignoré:`, e);
        }
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Tous les casiers',
        detail: 'Tous les casiers ont été ouverts'
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur globale',
        detail: 'Erreur lors de l\'ouverture des casiers'
      });
    }
  }

  async closeAllLockers(): Promise<void> {
    this.messageService.add({
      severity: 'info',
      summary: 'Fermeture',
      detail: 'La fermeture des casiers se fait manuellement'
    });
  }

  private addRecentAction(action: string, locker: number): void {
    this.recentActions.unshift({ action, locker, time: new Date() });
    if (this.recentActions.length > 5) {
      this.recentActions = this.recentActions.slice(0, 5);
    }

    if (this.actionTimeout) {
      clearTimeout(this.actionTimeout);
    }
    this.actionTimeout = setTimeout(() => {
      this.recentActions = [];
    }, 30000);
  }
}
