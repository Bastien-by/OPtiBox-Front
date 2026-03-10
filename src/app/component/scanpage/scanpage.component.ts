import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { faBarcode } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { ScanService } from '../../services/scan.service';
import { StockService } from '../../services/stock.service';
import { CheckService } from '../../services/check.service';
import { AuthAppService } from '../../services/auth-app.service';

interface LockerStats {
  available: number;
  empty: number;
  total: number;
}

interface LockerInfo {
  hasStock: boolean;
}

@Component({
  selector: 'app-scanpage',
  standalone: true,
  templateUrl: './scanpage.component.html',
  styleUrls: ['./scanpage.component.css'],
  imports: [
    NgForOf,
    NgIf,
    ReactiveFormsModule,
    FormsModule,
    CarouselModule,
    TagModule,
    ButtonModule,
    DialogModule,
    ToastModule,
    FaIconComponent
  ],
  providers: [MessageService]
})
export class ScanpageComponent implements OnInit, OnDestroy {

  /* -------- LISTES / CASIERS -------- */

  availableStocks: any[] = [];
  loanedStocks: any[] = [];
  allStocks: any[] = [];

  lockers: number[] = Array.from({ length: 24 }, (_, i) => i + 1);
  lockersMap: { [lockerNumber: number]: LockerInfo | undefined } = {};

  stats: LockerStats = {
    available: 0,
    empty: 0,
    total: 24
  };

  /* Contexte courant */

  activeLocker: number | null = null;
  lockerStocks: any[] = [];
  lockerDetailsDialogVisible = false;

  /* Retrait */

  withdrawDialogVisible = false;
  withdrawQuantity = 1;
  withdrawMax = 0;
  withdrawStocksPool: any[] = [];

  /* Dépôt */

  depositDialogVisible = false;
  depositQuantity = 1;
  depositMax = 0;
  depositStocksPool: any[] = [];

  /* Confirmation de fermeture casier */

  lockerCloseDialogVisible = false;
  private lockedFlow: 'withdraw' | 'deposit' | null = null;

  /* Scan douchette */

  scanDialogVisible = false;
  scanMode: 'withdraw' | 'deposit' | null = null;
  targetScanCount = 0;
  scannedCount = 0;

  /** Liste des alitracer attendus pour ce cycle */
  expectedAlitracers: string[] = [];

  /* Polling douchette */
  private pollingInterval: any;
  private isProcessing = false;

  /* Modèles métier pour historique */

  stock: any = {
    product: {
      title: '',
      type: '',
      size: '',
      cmu: '',
      location: '',
      picture: '',
      alitracer: ''
    },
    available: null,
    status: null,
    creationDate: null
  };

  review: any = {
    product: {
      title: '',
      type: '',
      size: '',
      cmu: '',
      location: '',
      picture: '',
      alitracer: ''
    },
    available: null,
    status: null,
    creationDate: null,
    lastCheckDate: null
  };

  history: any = {
    stock: {
      id: ''
    },
    user: {
      id: ''
    },
    date: '',
    type: 'withdraw'
  };

  isStockSelected = false;
  isButtonEnabled = true;

  responsiveOptions: any[] | undefined;

  constructor(
    protected scanService: ScanService,
    private messageService: MessageService,
    protected stockService: StockService,
    private checkService: CheckService,
    private authApp: AuthAppService
  ) {}

  async ngOnInit(): Promise<void> {
    this.responsiveOptions = [
      { breakpoint: '1400px', numVisible: 3, numScroll: 3 },
      { breakpoint: '1220px', numVisible: 2, numScroll: 2 },
      { breakpoint: '1100px', numVisible: 1, numScroll: 1 }
    ];

    await this.loadStocks();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  private async loadStocks(): Promise<void> {
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();
    this.availableStocks = this.scanService.getAvailableStocks();
    this.loanedStocks = this.scanService.getLoanedStocks();
    this.allStocks = [...this.availableStocks, ...this.loanedStocks];
  }

  private async loadLastCheckDates(): Promise<void> {
    for (const stock of this.allStocks) {
      this.stockService.getCheckIdByStockId(stock.id).subscribe({
        next: (checks) => {
          if (checks.length > 0) {
            const latestCheck = checks.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0];
            stock.lastCheckDate = new Date(latestCheck.date).toLocaleString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          } else {
            stock.lastCheckDate = null;
          }
        },
        error: err => {
          console.error(`Erreur check pour stock ${stock.id}:`, err);
          stock.lastCheckDate = null;
        }
      });
    }
  }

  private buildLockersMapAndStats(): void {
    const map: { [lockerNumber: number]: LockerInfo } = {};
    let available = 0;
    let empty = 0;

    for (const num of this.lockers) {
      const stocks = this.getStocksByLocker(num);
      const hasStock = stocks.length > 0;
      map[num] = { hasStock };

      if (hasStock) {
        if (stocks.some(s => s.available === true && s.status !== 2)) {
          available++;
        }
      } else {
        empty++;
      }
    }

    this.lockersMap = map;
    this.stats = {
      available,
      empty,
      total: this.lockers.length
    };
  }

  async refreshLockers(): Promise<void> {
    await this.updateAvailableStocks();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
  }

  /* -------- AUTH -------- */

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

  /* -------- CASIERS / STOCKS -------- */

  getStocksByLocker(lockerNumber: number) {
    return this.allStocks.filter(s => s.lockerNumber === lockerNumber);
  }

  openLockerDetails(lockerNumber: number): void {
    this.activeLocker = lockerNumber;
    this.lockerStocks = this.getStocksByLocker(lockerNumber);
    this.lockerDetailsDialogVisible = true;
  }

  getStatusClass(stock: any): string {
    if (stock.status === 1) {
      return 'text-green-500 font-bold';
    }
    if (stock.status === 0) {
      return 'text-black font-bold';
    }
    if (stock.status === 2) {
      return 'text-red-600 font-bold';
    }
    return 'text-gray-500';
  }

  canWithdraw(lockerNumber: number): boolean {
    return this.getStocksByLocker(lockerNumber).some(
      s => s.available === true && s.status !== 2
    );
  }

  /* -------- RETRAIT -------- */

  openWithdrawDialog(lockerNumber: number): void {
    const stocks = this.getStocksByLocker(lockerNumber);

    this.withdrawStocksPool = stocks.filter(
      s => s.available === true && s.status !== 2
    );
    this.withdrawMax = this.withdrawStocksPool.length;

    if (this.withdrawMax === 0) {
      const hasAvailableHs = stocks.some(
        s => s.available === true && s.status === 2
      );

      if (hasAvailableHs) {
        this.messageService.add({
          severity: 'error',
          summary: 'Produit HS',
          detail: `Impossible de retirer dans le casier ${lockerNumber} : les stocks disponibles sont HS.`
        });
      } else {
        this.messageService.add({
          severity: 'info',
          summary: 'Aucun outil à retirer',
          detail: `Il n'y a aucun outil disponible à retirer dans le casier ${lockerNumber}.`
        });
      }
      return;
    }

    this.activeLocker = lockerNumber;
    this.withdrawQuantity = 1;
    this.withdrawDialogVisible = true;
  }

  async confirmWithdrawQuantity(): Promise<void> {
    if (!this.activeLocker) {
      return;
    }

    if (this.withdrawQuantity < 1 || this.withdrawQuantity > this.withdrawMax) {
      this.messageService.add({
        severity: 'error',
        summary: 'Quantité invalide',
        detail: `Vous devez saisir un nombre entre 1 et ${this.withdrawMax}.`
      });
      return;
    }

    this.withdrawDialogVisible = false;
    this.lockerDetailsDialogVisible = false;

    try {
      await this.scanService.openLocker(this.activeLocker);
      this.messageService.add({
        severity: 'info',
        summary: 'Casier ouvert',
        detail: `Casier ${this.activeLocker} ouvert, prenez les ${this.withdrawQuantity} stock(s).`
      });
    } catch (e) {
      console.error('Erreur ouverture casier (retrait) :', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur casier',
        detail: `Impossible d'ouvrir le casier ${this.activeLocker}.`
      });
      return;
    }

    this.expectedAlitracers = this.withdrawStocksPool.map(s => s.alitracer);

    this.lockedFlow = 'withdraw';
    this.lockerCloseDialogVisible = true;
  }


  /* -------- CONFIRMATION FERMETURE CASIER -------- */

  async confirmLockerClosed(): Promise<void> {
    this.lockerCloseDialogVisible = false;

    if (!this.activeLocker) {
      console.error('Aucun casier actif pour fermeture');
      return;
    }

    try {
      await this.scanService.closeLocker(this.activeLocker);
      this.messageService.add({
        severity: 'info',
        summary: 'Casier fermé',
        detail: `Casier ${this.activeLocker} fermé.`
      });
    } catch (e) {
      console.error('Erreur fermeture casier :', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur casier',
        detail: `Impossible de fermer le casier ${this.activeLocker}.`
      });
    }

    if (this.lockedFlow === 'withdraw') {
      this.scanMode = 'withdraw';
      this.targetScanCount = this.withdrawQuantity;
      this.scannedCount = 0;
      this.scanDialogVisible = true;

      // ✅ DÉMARRE le polling douchette
      setTimeout(() => this.startPolling(), 0);
    }

    if (this.lockedFlow === 'deposit') {
      this.lockedFlow = null;
    }
  }

  /* -------- POLLING DOUCHETTE -------- */

  /**
   * ✅ Démarre le polling (1250ms)
   */
  private startPolling(): void {
    console.log('⚡ POLLING DOUCHETTE START (1000ms)');

    // Clear initial
    this.scanService.clearScan();

    let pollCount = 0;
    const startTime = Date.now();

    this.pollingInterval = setInterval(() => {
      if (this.isProcessing) return;

      pollCount++;

      this.scanService.readScan().then(response => {
        const elapsed = Date.now() - startTime;

        console.log(`[${pollCount}] ${elapsed}ms:`, response);

        if (response && response.success && response.value) {
          const val = response.value.trim();

          if (val !== '') {
            console.log(`✅ SCAN DÉTECTÉ en ${elapsed}ms: "${val}"`);

            this.isProcessing = true;

            // Traite le scan
            this.handleScannedCode(val);
          }
        }
      }).catch(err => {
        console.error('Erreur poll:', err);
      });

    }, 1250);  // ✅ 1250ms
  }

  /**
   * ✅ Arrête le polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('⏹️ POLLING STOP');
    }
    this.isProcessing = false;
  }

  /**
   * ✅ Traite le code scanné par la douchette
   */
  private async handleScannedCode(decodedText: string): Promise<void> {
    console.log('🔍 Traitement scan:', decodedText);

    const alitracer = decodedText.trim();

    // Vérifie que l'alitracer fait partie des attendus
    if (this.expectedAlitracers.length > 0 && !this.expectedAlitracers.includes(alitracer)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Alitracer non attendu',
        detail: `Le code scanné ne fait pas partie des outils attendus pour le casier ${this.activeLocker}.`
      });
      this.isProcessing = false;
      return;
    }

    const stock = this.allStocks.find(s => s.alitracer === alitracer);

    if (!stock) {
      this.messageService.add({
        severity: 'error',
        summary: 'Stock introuvable',
        detail: `Aucun stock trouvé pour l'ID Alitracer scanné.`
      });
      this.isProcessing = false;
      return;
    }

    // Blocage HS
    if (stock.status === 2) {
      this.messageService.add({
        severity: 'error',
        summary: 'Produit HS',
        detail: 'Ce stock est HS, il ne peut pas être retiré ou déposé via le scan.'
      });
      this.isProcessing = false;
      return;
    }

    if (this.scanMode === 'withdraw') {
      if (!stock.available) {
        this.messageService.add({
          severity: 'error',
          summary: 'Stock déjà emprunté',
          detail: 'Ce stock est déjà emprunté, il ne peut pas être retiré à nouveau.'
        });
        this.isProcessing = false;
        return;
      }

      await this.processWithdrawScan(stock);
    }

    if (this.scanMode === 'deposit') {
      if (stock.available) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Déjà en stock',
          detail: 'Ce stock est déjà disponible, il ne peut pas être déposé à nouveau.'
        });
        this.isProcessing = false;
        return;
      }

      await this.processDepositScan(stock);
    }

    this.scannedCount++;

    // ✅ Clear UNE SEULE FOIS après traitement réussi
    await this.scanService.clearScan();
    console.log('🧹 Buffer cleared');

    this.isProcessing = false;

    if (this.scannedCount >= this.targetScanCount) {
      this.stopPolling();
      this.scanDialogVisible = false;

      if (this.scanMode === 'deposit' && this.activeLocker) {
        try {
          await this.scanService.openLocker(this.activeLocker);
          this.lockedFlow = 'deposit';
          this.lockerCloseDialogVisible = true;
        } catch (e) {
          console.error('Erreur ouverture casier (dépôt) :', e);
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur casier',
            detail: `Impossible d'ouvrir le casier ${this.activeLocker} pour dépôt.`
          });
        }
      }

      this.scanMode = null;
      await this.updateAvailableStocks();
      await this.loadLastCheckDates();
      this.buildLockersMapAndStats();
    }
  }

  private async processWithdrawScan(stock: any): Promise<void> {
    this.history.type = 'withdraw';
    this.stock.id = stock.id;
    this.review = stock;
    this.isStockSelected = true;
    this.getLatestDate();
    await this.addScan('withdraw');
  }

  private async processDepositScan(stock: any): Promise<void> {
    this.history.type = 'deposit';
    this.stock.id = stock.id;
    this.review = stock;
    this.isStockSelected = true;
    this.getLatestDate();
    await this.addScan('deposit');
  }

  /* -------- HISTORIQUE / STATUTS -------- */

  async addScan(type: string): Promise<void> {
    const appUser = this.authApp.getCurrentUser();
    if (!appUser) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Vous devez être connecté pour effectuer un retrait ou un dépôt.'
      });
      return;
    }

    this.isButtonEnabled = false;

    const date = new Date();
    this.history.date = date.toISOString();
    this.history.user.id = appUser.id;
    this.history.stock.id = this.stock.id;
    this.history.type = type;

    try {
      await this.scanService.createHistory(this.history);
      this.showAddToast();
      await this.scanService.refreshData();
      await this.updateAvailableStocks();
      await this.loadLastCheckDates();
      this.buildLockersMapAndStats();
    } catch (error) {
      console.error('Error adding scan:', error);
    }

    this.stock.id = '';
    this.history.stock.id = '';
    this.isStockSelected = false;
    this.isButtonEnabled = true;
  }

  async updateAvailableStocks(): Promise<void> {
    await this.loadStocks();
  }

  getLatestDate(): void {
    this.stockService.getCheckIdByStockId(this.stock.id).subscribe({
      next: checks => {
        if (checks.length > 0) {
          const latestCheck = checks.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )[0];
          this.review.lastCheckDate = new Date(latestCheck.date).toLocaleString();
        } else {
          this.review.lastCheckDate = 'Aucune donnée disponible';
        }
      },
      error: err => {
        console.error('Erreur lors de la récupération des checks:', err);
      }
    });
  }

  /* -------- TOASTS -------- */

  showAddToast(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Succès',
      detail: 'L\'opération a été enregistrée'
    });
  }

  protected readonly faBarcode = faBarcode;
}
