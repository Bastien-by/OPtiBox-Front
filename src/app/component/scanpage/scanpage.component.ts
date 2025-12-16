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

  availableStocks: any[] = [];
  loanedStocks: any[] = [];

  // Scanner produit
  scannerVisible = false;
  private html5QrCodeProduct?: Html5Qrcode;
  private productScannerInitialized = false;

  // Scanner badge
  badgeScannerVisible = false;
  private html5QrCodeBadge?: Html5Qrcode;
  private badgeScannerInitialized = false;

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
      picture: ''
    },
    available: null,
    status: null,
    creationDate: null,
    lastCheckDate: null
  };

  scan: any = {
    badge: ''
  };

  user: any = {
    username: '',
    token: ''
  };

  users: any[] = [];

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
    private stockService: StockService,
    private checkService: CheckService
  ) {}

  async ngOnInit(): Promise<void> {
    this.responsiveOptions = [
      { breakpoint: '1400px', numVisible: 3, numScroll: 3 },
      { breakpoint: '1220px', numVisible: 2, numScroll: 2 },
      { breakpoint: '1100px', numVisible: 1, numScroll: 1 }
    ];

    this.scanService.refreshAvailableStocks();
    this.scanService.refreshLoanedStocks();
    this.availableStocks = this.scanService.getAvailableStocks();
    this.loanedStocks = this.scanService.getLoanedStocks();
  }

  ngOnDestroy(): void {
    this.stopProductScanner();
    this.stopBadgeScanner();
  }

  /* -------- SCAN PRODUIT -------- */

  async toggleScanner(): Promise<void> {
    if (this.scannerVisible) {
      this.scannerVisible = false;
      await this.stopProductScanner();
    } else {
      this.scannerVisible = true;
      setTimeout(() => this.startProductScanner(), 0);
    }
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
          this.scannerVisible = false;
          this.stopProductScanner();
        },
        () => {
          // erreurs de scan non bloquantes
        }
      );
      this.productScannerInitialized = true;
    } catch (err) {
      console.error('Erreur lors du démarrage du scanner produit', err);
      this.scannerVisible = false;
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

  /* -------- SCAN BADGE -------- */

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
        (decodedText: string) => {
          this.scan.badge = decodedText;
          this.detectBadge();
          this.badgeScannerVisible = false;
          this.stopBadgeScanner();
        },
        () => {
          // erreurs de scan non bloquantes
        }
      );
      this.badgeScannerInitialized = true;
    } catch (err) {
      console.error('Erreur lors du démarrage du scanner badge', err);
      this.badgeScannerVisible = false;
    }
  }

  private async stopBadgeScanner(): Promise<void> {
    if (this.html5QrCodeBadge && this.badgeScannerInitialized) {
      try {
        await this.html5QrCodeBadge.stop();
        await this.html5QrCodeBadge.clear();
      } catch (err) {
        console.error('Erreur à l’arrêt du scanner badge', err);
      }
    }
    this.html5QrCodeBadge = undefined;
    this.badgeScannerInitialized = false;
  }

  /* -------- BADGE / UTILISATEUR -------- */

  async detectBadge(): Promise<void> {
    this.users = this.scanService.getUsers();
    let badgeExist = false;

    this.users.forEach((user: any) => {
      if (user.token === this.scan.badge) {
        this.user = user;
        this.showFindToast();
        badgeExist = true;
      }
    });

    if (this.scan.badge.trim().length === 0) {
      this.showEmptyFormToast();
      return;
    }

    if (!badgeExist) {
      this.showErrorToast();
      return;
    }

    try {
      await this.scanService.refreshData();
      this.updateAvailableStocks();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }

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

    // Règles métiers
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

  async addScan(type: string): Promise<void> {
    if (this.user.username === '') {
      this.showErrorToast();
      return;
    }

    this.isButtonEnabled = false;

    const date = new Date();
    this.history.date = date.toISOString();
    this.history.user.id = this.user.id;
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
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();
    this.availableStocks = this.scanService.getAvailableStocks();
    this.loanedStocks = this.scanService.getLoanedStocks();
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
        picture: ''
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

  disconnect(): void {
    this.user = {
      username: '',
      token: ''
    };
  }

  /* -------- TOASTS -------- */

  showAddToast(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Vous avez sorti un élement du stock'
    });
  }

  showFindToast(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Badge reconnu. Bonjour ' + this.user.username
    });
  }

  showErrorToast(): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Badge non reconnu'
    });
  }

  showEmptyFormToast(): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Error',
      detail: 'Le champ ne peut pas être vide'
    });
  }

  protected readonly faBarcode = faBarcode;
  protected readonly faArrowRightToBracket = faArrowRightToBracket;
  protected readonly faArrowRightFromBracket = faArrowRightFromBracket;
}
