import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  faArrowRightFromBracket,
  faArrowRightToBracket,
  faBarcode
} from '@fortawesome/free-solid-svg-icons';
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

  /* Dialog sélection de stocks dans un casier */
  lockerDialogVisible = false;
  selectedLocker: number | null = null;
  lockerStocks: any[] = []; // stocks du casier courant (avec flag selected)

  /* Dialog de scan */
  scanDialogVisible = false;
  stocksToProcess: any[] = [];
  currentStockIndex = 0;

  /* Scanner produit (html5-qrcode) */
  private html5QrCodeProduct?: Html5Qrcode;
  private productScannerInitialized = false;

  selectedAvailability: boolean | null = null;

  /* Modèles métier existants */

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

  dialog1Visible = false;
  dialog2Visible = false;

  responsiveOptions: any[] | undefined;

  isStockSelected = false;
  isButtonEnabled = true;

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

  /* Clic sur "Ouvrir" un casier :
     étape 1 = afficher popup de sélection, pas encore ouvrir physiquement.
  */
  openLockerDialog(lockerNumber: number): void {
    this.selectedLocker = lockerNumber;
    this.lockerStocks = this.getStocksByLocker(lockerNumber).map(s => ({
      ...s,
      selected: false
    }));
    this.selectedAvailability = null;
    this.lockerDialogVisible = true;
  }

  /* Après clic sur "Valider la sélection" dans le popup casier :
     1) on ouvre physiquement le casier
     2) on ouvre le popup de scan
  */
  async validateLockerSelection(): Promise<void> {
    const selected = this.lockerStocks.filter(s => s.selected);

    if (selected.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sélection vide',
        detail: 'Veuillez sélectionner au moins un stock.'
      });
      return;
    }

    if (!this.selectedLocker) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Casier non défini.'
      });
      return;
    }

    this.lockerDialogVisible = false;

    try {
      // ouvrir physiquement le casier maintenant
      await this.scanService.openLocker(this.selectedLocker);
      this.messageService.add({
        severity: 'info',
        summary: 'Casier ouvert',
        detail: `Casier ${this.selectedLocker} ouvert, scannez les stocks sélectionnés.`
      });
    } catch (e) {
      console.error('Erreur ouverture casier:', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: `Impossible d'ouvrir le casier ${this.selectedLocker}.`
      });
      return;
    }

    // lancer le workflow de scan pour les stocks cochés
    this.startScanForSelectedStocks(selected);
  }

  onLockerStockToggle(stock: any): void {
    const availability = stock.available; // true/false

    // premier stock sélectionné : on fixe la règle
    if (this.selectedAvailability === null && stock.selected) {
      this.selectedAvailability = availability;
      return;
    }

    // si on essaye de cocher un stock d'un autre type, on annule
    if (stock.selected && this.selectedAvailability !== availability) {
      stock.selected = false;
      this.messageService.add({
        severity: 'warn',
        summary: 'Sélection incompatible',
        detail: this.selectedAvailability
          ? 'Vous avez déjà sélectionné un stock Disponible, vous ne pouvez pas sélectionner un stock Emprunté.'
          : 'Vous avez déjà sélectionné un stock Emprunté, vous ne pouvez pas sélectionner un stock Disponible.'
      });
    }

    // si on décoche tout, on réinitialise la règle
    const stillSelected = this.lockerStocks.some(s => s.selected);
    if (!stillSelected) {
      this.selectedAvailability = null;
    }
  }

  /* -------- WORKFLOW DE SCAN MULTI-STOCKS -------- */

  startScanForSelectedStocks(stocks: any[]): void {
    this.stocksToProcess = stocks;
    this.currentStockIndex = 0;

    // ouvrir le dialog de scan
    this.scanDialogVisible = true;

    // laisser le dialog se rendre, puis lancer la caméra
    setTimeout(() => {
      this.askNextScan();
    }, 0);
  }

  private async askNextScan(): Promise<void> {
    if (this.currentStockIndex >= this.stocksToProcess.length) {
      this.messageService.add({
        severity: 'success',
        summary: 'Terminé',
        detail: 'Tous les stocks sélectionnés ont été traités.'
      });
      await this.stopProductScanner();
      this.scanDialogVisible = false;
      return;
    }

    const current = this.stocksToProcess[this.currentStockIndex];

    this.messageService.add({
      severity: 'info',
      summary: 'Scan requis',
      detail: `Scannez l'ID Alitracer du stock : ${current.alitracer}`
    });

    await this.startScannerForCurrentStock(current);
  }

  private async startScannerForCurrentStock(current: any): Promise<void> {
    if (this.html5QrCodeProduct) {
      await this.stopProductScanner();
    }

    const elementId = 'qr-reader';
    this.html5QrCodeProduct = new Html5Qrcode(elementId);

    try {
      await this.html5QrCodeProduct.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          if (decodedText !== current.alitracer) {
            this.messageService.add({
              severity: 'error',
              summary: 'ID incorrect',
              detail: `L'ID scanné (${decodedText}) ne correspond pas à ${current.alitracer}.`
            });
            return;
          }

          await this.stopProductScanner();

          const type: 'withdraw' | 'deposit' = current.available ? 'withdraw' : 'deposit';
          await this.onWithdrawOrDeposit(current, type);

          this.currentStockIndex++;
          this.askNextScan();
        },
        () => {
          // erreurs de scan ignorées
        }
      );
      this.productScannerInitialized = true;
    } catch (err) {
      console.error('Erreur lors du démarrage du scanner produit (workflow multi-stocks)', err);
    }
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

  private async onWithdrawOrDeposit(stock: any, type: 'withdraw' | 'deposit') {
    if (type === 'withdraw') {
      await this.onWithdraw(stock);
    } else {
      await this.onDeposit(stock);
    }
  }

  /* -------- ANCIEN SCAN PRODUIT DIRECT (optionnel) -------- */

  async toggleScanner(): Promise<void> {
    if (this.productScannerInitialized) {
      await this.stopProductScanner();
      this.scanDialogVisible = false;
      return;
    }

    this.scanDialogVisible = true;

    setTimeout(() => this.startProductScanner(), 0);
  }

  private async startProductScanner(): Promise<void> {
    if (this.productScannerInitialized) {
      return;
    }

    const elementId = 'qr-reader';
    this.html5QrCodeProduct = new Html5Qrcode(elementId);

    try {
      await this.html5QrCodeProduct.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          this.stock.alitracer = decodedText;
          this.detectStock();
          this.stopProductScanner();
          this.scanDialogVisible = false;
        },
        () => {
          // erreurs de scan non bloquantes
        }
      );
      this.productScannerInitialized = true;
    } catch (err) {
      console.error('Erreur lors du démarrage du scanner produit', err);
      this.scanDialogVisible = false;
    }
  }

  /* -------- TYPE (retrait / dépôt) -------- */

  setType(type: string): void {
    this.resetSelectedStock();
    this.history.type = type;
  }

  /* -------- STOCK / PRODUIT -------- */

  async detectStock(): Promise<void> {
    if (!this.stock.alitracer) {
      return;
    }

    this.review = this.stockService.getStockByAlitracer(this.stock.alitracer);

    if (!this.review) {
      this.isStockSelected = false;
      this.messageService.add({
        severity: 'warn',
        summary: 'Stock non trouvé',
        detail: `Aucun stock trouvé avec l'ID Alitracer: ${this.stock.alitracer}`
      });
      return;
    }

    if (this.history.type === 'withdraw' && this.review.available === false) {
      this.isStockSelected = false;
      this.messageService.add({
        severity: 'warn',
        summary: 'Indisponible',
        detail: `Ce produit est déjà emprunté, vous ne pouvez pas le retirer.`
      });
      return;
    }

    if (this.history.type === 'deposit' && this.review.available === true) {
      this.isStockSelected = false;
      this.messageService.add({
        severity: 'warn',
        summary: 'Indisponible',
        detail: `Ce produit est déjà en stock, vous ne pouvez pas le déposer.`
      });
      return;
    }

    this.isStockSelected = true;
    this.stock.id = this.review.id;
    this.getLatestDate();
  }

  onWithdraw(stock: any): void {
    this.history.type = 'withdraw';
    this.stock.id = stock.id;
    this.review = stock;
    this.isStockSelected = true;
    this.getLatestDate();
    this.addScan('withdraw');
  }

  onDeposit(stock: any): void {
    this.history.type = 'deposit';
    this.stock.id = stock.id;
    this.review = stock;
    this.isStockSelected = true;
    this.getLatestDate();
    this.addScan('deposit');
  }

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

      const lockerNumber = this.review.lockerNumber;

      if (lockerNumber) {
        await this.scanService.openLocker(lockerNumber);
        console.log(`Casier ${lockerNumber} ouvert avec succès`);
      } else {
        console.warn('Aucun numéro de casier trouvé pour ce stock');
      }

      this.showAddToast();
      await this.scanService.refreshData();
      this.updateAvailableStocks();
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

  resetSelectedStock(): void {
    this.stock = {
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

    this.history = {
      stock: {
        id: ''
      },
      user: {
        id: ''
      },
      date: '',
      type: 'withdraw'
    };

    this.review = {
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

  getStatusClass(): string {
    return this.checkService.getStatusClass(this.review);
  }

  /* -------- TOASTS -------- */

  showAddToast(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'L\'opération a été enregistrée'
    });
  }

  protected readonly faBarcode = faBarcode;
  protected readonly faArrowRightToBracket = faArrowRightToBracket;
  protected readonly faArrowRightFromBracket = faArrowRightFromBracket;
}
