import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { faBarcode } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanService } from '../../services/scan.service';
import { StockService } from '../../services/stock.service';
import { CheckService } from '../../services/check.service';
import { AuthAppService } from '../../services/auth-app.service';

@Component({
  selector: 'app-scanpage',
  standalone: true,
  templateUrl: './scanpage.component.html',
  styleUrls: ['./scanpage.component.css'],
  imports: [
    NgForOf,
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

  /* Contexte courant */

  activeLocker: number | null = null;

  /* Retrait */

  withdrawDialogVisible = false;
  withdrawQuantity = 1;
  withdrawMax = 0;
  /** stocks disponibles ET non HS dans le casier actif */
  withdrawStocksPool: any[] = [];

  /* Dépôt */

  depositDialogVisible = false;
  depositQuantity = 1;
  depositMax = 0;
  /** stocks empruntés ET non HS dans le casier actif */
  depositStocksPool: any[] = [];

  /* Confirmation de fermeture casier */

  lockerCloseDialogVisible = false;
  private lockedFlow: 'withdraw' | 'deposit' | null = null;

  /* Scan caméra */

  scanDialogVisible = false;
  scanMode: 'withdraw' | 'deposit' | null = null;
  targetScanCount = 0;
  scannedCount = 0;
  scanLocked = false;

  private html5QrCodeProduct?: Html5Qrcode;
  private productScannerInitialized = false;

  /** Liste des alitracer attendus pour ce cycle (toujours filtrés sur le casier actif et la quantité) */
  expectedAlitracers: string[] = [];

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
  }

  ngOnDestroy(): void {
    this.stopProductScanner();
  }

  private async loadStocks(): Promise<void> {
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();
    this.availableStocks = this.scanService.getAvailableStocks();
    this.loanedStocks = this.scanService.getLoanedStocks();
    this.allStocks = [...this.availableStocks, ...this.loanedStocks];
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

  /**
   * Classe de statut : vert = OK, noir gras = NOK, rouge = HS
   */
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

  /**
   * On peut retirer si au moins un stock est disponible ET non HS
   */
  canWithdraw(lockerNumber: number): boolean {
    return this.getStocksByLocker(lockerNumber).some(
      s => s.available === true && s.status !== 2
    );
  }

  /**
   * On peut déposer si au moins un stock est emprunté ET non HS
   */
  canDeposit(lockerNumber: number): boolean {
    return this.getStocksByLocker(lockerNumber).some(
      s => s.available === false && s.status !== 2
    );
  }

  /* -------- RETRAIT -------- */

  openWithdrawDialog(lockerNumber: number): void {
    const stocks = this.getStocksByLocker(lockerNumber);

    // stocks dispo non HS
    this.withdrawStocksPool = stocks.filter(
      s => s.available === true && s.status !== 2
    );
    this.withdrawMax = this.withdrawStocksPool.length;

    if (this.withdrawMax === 0) {
      // Soit aucun dispo, soit tous les dispo sont HS -> message clair
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

    // tous les alitracer disponibles non HS de ce casier seront acceptés
    this.expectedAlitracers = this.withdrawStocksPool.map(s => s.alitracer);

    this.lockedFlow = 'withdraw';
    this.lockerCloseDialogVisible = true;
  }

  /* -------- DÉPÔT -------- */

  openDepositDialog(lockerNumber: number): void {
    const stocks = this.getStocksByLocker(lockerNumber);

    // stocks empruntés non HS
    this.depositStocksPool = stocks.filter(
      s => s.available === false && s.status !== 2
    );
    this.depositMax = this.depositStocksPool.length;

    if (this.depositMax === 0) {
      const hasLoanedHs = stocks.some(
        s => s.available === false && s.status === 2
      );

      if (hasLoanedHs) {
        this.messageService.add({
          severity: 'error',
          summary: 'Produit HS',
          detail: `Impossible de déposer dans le casier ${lockerNumber} : les stocks empruntés sont HS.`
        });
      } else {
        this.messageService.add({
          severity: 'info',
          summary: 'Aucun outil à déposer',
          detail: `Il n'y a aucun outil emprunté à déposer pour le casier ${lockerNumber}.`
        });
      }
      return;
    }

    this.activeLocker = lockerNumber;
    this.depositQuantity = 1;
    this.depositDialogVisible = true;
  }

  async confirmDepositQuantity(): Promise<void> {
    if (!this.activeLocker) {
      return;
    }

    if (this.depositQuantity < 1 || this.depositQuantity > this.depositMax) {
      this.messageService.add({
        severity: 'error',
        summary: 'Quantité invalide',
        detail: `Vous devez saisir un nombre entre 1 et ${this.depositMax}.`
      });
      return;
    }

    this.depositDialogVisible = false;

    // tous les alitracer empruntés non HS de ce casier seront acceptés
    this.expectedAlitracers = this.depositStocksPool.map(s => s.alitracer);

    this.scanMode = 'deposit';
    this.targetScanCount = this.depositQuantity;
    this.scannedCount = 0;
    this.scanDialogVisible = true;

    setTimeout(() => this.startScanWorkflow(), 0);
  }

  /* -------- CONFIRMATION FERMETURE CASIER (retrait) -------- */

  confirmLockerClosed(): void {
    this.lockerCloseDialogVisible = false;

    if (this.lockedFlow === 'withdraw') {
      this.scanMode = 'withdraw';
      this.targetScanCount = this.withdrawQuantity;
      this.scannedCount = 0;
      this.scanDialogVisible = true;

      setTimeout(() => this.startScanWorkflow(), 0);
    }

    if (this.lockedFlow === 'deposit') {
      this.lockedFlow = null;
    }
  }

  /* -------- SCAN WORKFLOW -------- */

  private async startScanWorkflow(): Promise<void> {
    await this.stopProductScanner();

    const elementId = 'qr-reader';
    this.html5QrCodeProduct = new Html5Qrcode(elementId);

    try {
      await this.html5QrCodeProduct.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          await this.handleScannedCode(decodedText);
        },
        () => {}
      );
      this.productScannerInitialized = true;
    } catch (err) {
      console.error('Erreur démarrage scanner :', err);
      this.scanDialogVisible = false;
    }
  }

  private async handleScannedCode(decodedText: string): Promise<void> {
    if (!this.scanMode || this.scanLocked) {
      return;
    }

    this.scanLocked = true;
    setTimeout(() => {
      this.scanLocked = false;
    }, 4000);

    const alitracer = decodedText.trim();

    if (this.expectedAlitracers.length > 0 && !this.expectedAlitracers.includes(alitracer)) {
      this.messageService.add({
        severity: 'error',
        summary: 'Alitracer non attendu',
        detail: `Le code scanné ne fait pas partie des outils attendus pour le casier ${this.activeLocker}.`
      });
      return;
    }

    const stock = this.allStocks.find(s => s.alitracer === alitracer);

    if (!stock) {
      this.messageService.add({
        severity: 'error',
        summary: 'Stock introuvable',
        detail: `Aucun stock trouvé pour l'ID Alitracer scanné.`
      });
      return;
    }

    // Blocage HS : ni retrait ni dépôt pour un produit HS
    if (stock.status === 2) {
      this.messageService.add({
        severity: 'error',
        summary: 'Produit HS',
        detail: 'Ce stock est HS, il ne peut pas être retiré ou déposé via le scan.'
      });
      return;
    }

    if (this.scanMode === 'withdraw') {
      if (!stock.available) {
        this.messageService.add({
          severity: 'error',
          summary: 'Stock déjà emprunté',
          detail: 'Ce stock est déjà emprunté, il ne peut pas être retiré à nouveau.'
        });
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
        return;
      }

      await this.processDepositScan(stock);
    }

    this.scannedCount++;

    if (this.scannedCount >= this.targetScanCount) {
      await this.stopProductScanner();
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

  private async stopProductScanner(): Promise<void> {
    if (this.html5QrCodeProduct && this.productScannerInitialized) {
      try {
        await this.html5QrCodeProduct.stop();
        await this.html5QrCodeProduct.clear();
      } catch (err) {
        console.error('Erreur à l’arrêt du scanner produit', err);
      }
    }
    this.html5QrCodeProduct = undefined;
    this.productScannerInitialized = false;
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
