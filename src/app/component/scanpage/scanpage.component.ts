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
import { HistoryService } from '../../services/history.service';
import { ProductService } from '../../services/product.service';

interface LockerStats { available: number; empty: number; total: number; }
interface LockerInfo  { hasStock: boolean; }

/** Un filtre produit = un titre unique + l'image du premier stock trouvé avec ce titre. */
interface ProductFilter {
  title: string;
  picture: string;
}

@Component({
  selector: 'app-scanpage',
  standalone: true,
  templateUrl: './scanpage.component.html',
  styleUrls: ['./scanpage.component.css'],
  imports: [NgForOf, NgIf, ReactiveFormsModule, FormsModule, CarouselModule, TagModule, ButtonModule, DialogModule, ToastModule, FaIconComponent],
  providers: [MessageService]
})
export class ScanpageComponent implements OnInit, OnDestroy {

  // ── Stocks ────────────────────────────────────────────────────────────────
  availableStocks: any[] = [];
  loanedStocks: any[]    = [];
  allStocks: any[]       = [];

  // ── Casiers ───────────────────────────────────────────────────────────────
  lockers: number[] = Array.from({ length: 24 }, (_, i) => i + 1);
  lockersMap: { [lockerNumber: number]: LockerInfo | undefined } = {};
  stats: LockerStats = { available: 0, empty: 0, total: 24 };

  // ── Filtres produit ───────────────────────────────────────────────────────

  /**
   * Liste des filtres disponibles, construite dynamiquement depuis les stocks.
   * Un filtre par product.title unique, avec l'image du premier stock trouvé.
   */
  productFilters: ProductFilter[] = [];

  /**
   * Titre du filtre actif.
   * null = tous les casiers affichés.
   * Sinon = seuls les casiers contenant au moins un stock de ce type sont visibles.
   */
  activeFilterTitle: string | null = null;

  // ── Contexte courant ──────────────────────────────────────────────────────
  activeLocker: number | null    = null;
  lockerStocks: any[]            = [];
  lockerDetailsDialogVisible     = false;

  // ── Retrait ───────────────────────────────────────────────────────────────
  withdrawDialogVisible = false;
  withdrawQuantity      = 1;
  withdrawMax           = 0;
  withdrawStocksPool: any[] = [];

  // ── Dépôt ─────────────────────────────────────────────────────────────────
  depositDialogVisible = false;
  depositQuantity      = 1;
  depositMax           = 0;
  depositStocksPool: any[] = [];

  // ── Fermeture casier ──────────────────────────────────────────────────────
  lockerCloseDialogVisible = false;
  private lockedFlow: 'withdraw' | 'deposit' | null = null;

  // ── Scan douchette ────────────────────────────────────────────────────────
  scanDialogVisible = false;
  scanMode: 'withdraw' | 'deposit' | null = null;
  targetScanCount   = 0;
  scannedCount      = 0;
  expectedAlitracers: string[] = [];

  private pollingInterval: any;
  private isProcessing = false;

  // ── Modèles métier ────────────────────────────────────────────────────────
  stock: any   = { product: { title: '', type: '', size: '', cmu: '', location: '', picture: '', alitracer: '' }, available: null, status: null, creationDate: null };
  review: any  = { product: { title: '', type: '', size: '', cmu: '', location: '', picture: '', alitracer: '' }, available: null, status: null, creationDate: null, lastCheckDate: null };
  history: any = { stock: { id: '' }, user: { id: '' }, date: '', type: 'withdraw' };

  isStockSelected = false;
  isButtonEnabled = true;
  responsiveOptions: any[] | undefined;

  constructor(
    protected scanService: ScanService,
    private messageService: MessageService,
    protected stockService: StockService,
    private checkService: CheckService,
    private authApp: AuthAppService,
    private historyService: HistoryService,
    protected productService: ProductService
  ) {}

  async ngOnInit(): Promise<void> {
    this.responsiveOptions = [
      { breakpoint: '1400px', numVisible: 3, numScroll: 3 },
      { breakpoint: '1220px', numVisible: 2, numScroll: 2 },
      { breakpoint: '1100px', numVisible: 1, numScroll: 1 }
    ];
    await this.loadStocks();
    await this.loadLastCheckDates();
    await this.historyService.refreshHistory();
    this.loadBorrowers();
    this.buildProductFilters();
    this.buildLockersMapAndStats();
  }

  ngOnDestroy(): void { this.stopPolling(); }

  // ── Chargement données ────────────────────────────────────────────────────

  private async loadStocks(): Promise<void> {
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();
    this.availableStocks = this.scanService.getAvailableStocks();
    this.loanedStocks    = this.scanService.getLoanedStocks();
    this.allStocks       = [...this.availableStocks, ...this.loanedStocks];
  }

  private async loadLastCheckDates(): Promise<void> {
    for (const stock of this.allStocks) {
      this.stockService.getCheckIdByStockId(stock.id).subscribe({
        next: (checks) => {
          if (checks.length > 0) {
            const latestCheck = checks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
            stock.lastCheckDate = new Date(latestCheck.date).toLocaleString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
          } else {
            stock.lastCheckDate = null;
          }
        },
        error: () => { stock.lastCheckDate = null; }
      });
    }
  }

  private loadBorrowers(): void {
    const allWithdrawHistory = this.historyService.getAllWithdrawHistory();
    for (const stock of this.allStocks) {
      if (!stock.available) {
        const stockHistories = allWithdrawHistory.filter(h => String(h.stock?.id) === String(stock.id));
        const lastWithdraw   = stockHistories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        stock.borrowedBy = lastWithdraw?.user ?? null;
      } else {
        stock.borrowedBy = null;
      }
    }
  }

  // ── Filtres produit ───────────────────────────────────────────────────────

  /**
   * Construit la liste des filtres depuis les stocks chargés.
   * Déduplique par product.title et prend l'image du premier stock trouvé.
   */
  private buildProductFilters(): void {
    const seen    = new Set<string>();
    const filters: ProductFilter[] = [];

    for (const stock of this.allStocks) {
      const title = stock.product?.title;
      if (title && !seen.has(title)) {
        seen.add(title);
        filters.push({
          title,
          picture: stock.product?.picture || 'assets/images/default_image.jpg'
        });
      }
    }
    this.productFilters = filters;
  }

  /** Active ou désactive un filtre. Cliquer sur le filtre actif le désactive. */
  setFilter(title: string | null): void {
    this.activeFilterTitle = this.activeFilterTitle === title ? null : title;
  }

  /**
   * Casiers à afficher selon le filtre actif.
   * Sans filtre → les 24. Avec filtre → uniquement ceux contenant le type filtré.
   */
  get filteredLockers(): number[] {
    if (!this.activeFilterTitle) return this.lockers;
    return this.lockers.filter(num =>
      this.getStocksByLocker(num).some(s => s.product?.title === this.activeFilterTitle)
    );
  }

  /** Intersection d'une colonne fixe avec les casiers filtrés. */
  getCol(nums: number[]): number[] {
    return nums.filter(n => this.filteredLockers.includes(n));
  }

  /** Nombre de casiers contenant au moins un stock du type donné. */
  getLockerCountByTitle(title: string): number {
    return this.lockers.filter(num =>
      this.getStocksByLocker(num).some(s => s.product?.title === title)
    ).length;
  }

  // ── Stats & map casiers ───────────────────────────────────────────────────

  private buildLockersMapAndStats(): void {
    const map: { [lockerNumber: number]: LockerInfo } = {};
    let available = 0, empty = 0;

    for (const num of this.lockers) {
      const stocks   = this.getStocksByLocker(num);
      const hasStock = stocks.length > 0;
      map[num] = { hasStock };
      if (hasStock) {
        if (stocks.some(s => s.available === true && s.status !== 2)) available++;
      } else {
        empty++;
      }
    }
    this.lockersMap = map;
    this.stats = { available, empty, total: this.lockers.length };
  }

  async refreshLockers(): Promise<void> {
    await this.updateAvailableStocks();
    await this.loadLastCheckDates();
    await this.historyService.refreshHistory();
    this.loadBorrowers();
    this.buildProductFilters();
    this.buildLockersMapAndStats();
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  isLoggedIn()    { return this.authApp.isLoggedIn(); }
  isAdmin()       { return this.authApp.isAdmin(); }
  isMaintenance() { return this.authApp.isMaintenance(); }
  isOperator()    { return this.authApp.isOperator(); }

  // ── Casiers / Stocks ──────────────────────────────────────────────────────

  getStocksByLocker(lockerNumber: number): any[] {
    return this.allStocks.filter(s => s.lockerNumber === lockerNumber);
  }

  /** Retourne les alitracers d'un stock sous forme de tableau (multi-alitracer). */
  getAlitracerList(stock: any): string[] {
    return StockService.getAlitracerList(stock);
  }

  getLockerState(lockerNumber: number): 'empty' | 'allAvailable' | 'allBorrowed' | 'mixed' {
    const stocks = this.getStocksByLocker(lockerNumber);
    if (stocks.length === 0) return 'empty';
    const nonHs = stocks.filter(s => s.status !== 2);
    if (nonHs.length === 0) return 'allBorrowed';
    const availableCount = nonHs.filter(s => s.available === true).length;
    if (availableCount === nonHs.length) return 'allAvailable';
    if (availableCount === 0) return 'allBorrowed';
    return 'mixed';
  }

  getLockerRatio(lockerNumber: number): string {
    const stocks    = this.getStocksByLocker(lockerNumber);
    const available = stocks.filter(s => s.available === true && s.status !== 2).length;
    return `${available}/${stocks.length}`;
  }

  openLockerDetails(lockerNumber: number): void {
    this.activeLocker               = lockerNumber;
    this.lockerStocks               = this.getStocksByLocker(lockerNumber);
    this.lockerDetailsDialogVisible = true;
  }

  getStatusClass(stock: any): string {
    if (stock.status === 1) return 'text-green-500 font-bold';
    if (stock.status === 0) return 'text-black font-bold';
    if (stock.status === 2) return 'text-red-600 font-bold';
    return 'text-gray-500';
  }

  canWithdraw(lockerNumber: number): boolean {
    return this.getStocksByLocker(lockerNumber).some(s => s.available === true && s.status !== 2);
  }

  // ── Retrait ───────────────────────────────────────────────────────────────

  openWithdrawDialog(lockerNumber: number): void {
    const stocks            = this.getStocksByLocker(lockerNumber);
    this.withdrawStocksPool = stocks.filter(s => s.available === true && s.status !== 2);
    this.withdrawMax        = this.withdrawStocksPool.length;

    if (this.withdrawMax === 0) {
      const hasAvailableHs = stocks.some(s => s.available === true && s.status === 2);
      this.messageService.add({
        severity: hasAvailableHs ? 'error' : 'info',
        summary:  hasAvailableHs ? 'Produit HS' : 'Aucun outil à retirer',
        detail:   hasAvailableHs
          ? `Impossible de retirer dans le casier ${lockerNumber} : les stocks disponibles sont HS.`
          : `Aucun outil disponible à retirer dans le casier ${lockerNumber}.`
      });
      return;
    }

    this.activeLocker          = lockerNumber;
    this.withdrawQuantity      = 1;
    this.withdrawDialogVisible = true;
  }

  async confirmWithdrawQuantity(): Promise<void> {
    if (!this.activeLocker) return;

    if (this.withdrawQuantity < 1 || this.withdrawQuantity > this.withdrawMax) {
      this.messageService.add({ severity: 'error', summary: 'Quantité invalide', detail: `Saisissez un nombre entre 1 et ${this.withdrawMax}.` });
      return;
    }

    this.withdrawDialogVisible      = false;
    this.lockerDetailsDialogVisible = false;

    try {
      await this.scanService.openLocker(this.activeLocker);
      this.messageService.add({ severity: 'info', summary: 'Casier ouvert', detail: `Casier ${this.activeLocker} ouvert, prenez les ${this.withdrawQuantity} stock(s).` });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Erreur casier', detail: `Impossible d'ouvrir le casier ${this.activeLocker}.` });
      return;
    }

    // expectedAlitracers : tous les alitracers individuels du pool (multi-alitracer)
    this.expectedAlitracers = this.withdrawStocksPool.flatMap((s: any) => StockService.getAlitracerList(s));
    this.lockedFlow               = 'withdraw';
    this.lockerCloseDialogVisible = true;
  }

  // ── Fermeture casier ──────────────────────────────────────────────────────

  async confirmLockerClosed(): Promise<void> {
    this.lockerCloseDialogVisible = false;
    if (!this.activeLocker) return;

    try {
      await this.scanService.closeLocker(this.activeLocker);
      this.messageService.add({ severity: 'info', summary: 'Casier fermé', detail: `Casier ${this.activeLocker} fermé.` });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Erreur casier', detail: `Impossible de fermer le casier ${this.activeLocker}.` });
    }

    if (this.lockedFlow === 'withdraw') {
      this.scanMode       = 'withdraw';
      this.targetScanCount = this.withdrawQuantity;
      this.scannedCount   = 0;
      this.scanDialogVisible = true;
      setTimeout(() => this.startPolling(), 0);
    }
    if (this.lockedFlow === 'deposit') this.lockedFlow = null;
  }

  // ── Polling douchette ─────────────────────────────────────────────────────

  private startPolling(): void {
    this.scanService.clearScan();
    this.pollingInterval = setInterval(() => {
      if (this.isProcessing) return;
      this.scanService.readScan().then(response => {
        if (response?.success && response?.value) {
          const val = response.value.trim();
          if (val !== '') { this.isProcessing = true; this.handleScannedCode(val); }
        }
      }).catch(() => {});
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
    this.isProcessing = false;
  }

  private async handleScannedCode(decodedText: string): Promise<void> {
    const alitracer = decodedText.trim();

    if (this.expectedAlitracers.length > 0 && !this.expectedAlitracers.includes(alitracer)) {
      this.messageService.add({ severity: 'error', summary: 'Alitracer non attendu', detail: `Le code scanné ne fait pas partie des outils attendus pour le casier ${this.activeLocker}.` });
      this.isProcessing = false;
      return;
    }

    const stock = StockService.findByAlitracer(this.allStocks, alitracer);
    if (!stock) {
      this.messageService.add({ severity: 'error', summary: 'Stock introuvable', detail: "Aucun stock trouvé pour l'ID Alitracer scanné." });
      this.isProcessing = false;
      return;
    }
    if (stock.status === 2) {
      this.messageService.add({ severity: 'error', summary: 'Produit HS', detail: 'Ce stock est HS, il ne peut pas être retiré ou déposé.' });
      this.isProcessing = false;
      return;
    }

    if (this.scanMode === 'withdraw') {
      if (!stock.available) {
        this.messageService.add({ severity: 'error', summary: 'Stock déjà emprunté', detail: 'Ce stock est déjà emprunté.' });
        this.isProcessing = false;
        return;
      }
      await this.processWithdrawScan(stock);
    }

    if (this.scanMode === 'deposit') {
      if (stock.available) {
        this.messageService.add({ severity: 'warn', summary: 'Déjà en stock', detail: 'Ce stock est déjà disponible.' });
        this.isProcessing = false;
        return;
      }
      await this.processDepositScan(stock);
    }

    this.scannedCount++;
    await this.scanService.clearScan();
    this.isProcessing = false;

    if (this.scannedCount >= this.targetScanCount) {
      this.stopPolling();
      this.scanDialogVisible = false;
      if (this.scanMode === 'deposit' && this.activeLocker) {
        try {
          await this.scanService.openLocker(this.activeLocker);
          this.lockedFlow = 'deposit';
          this.lockerCloseDialogVisible = true;
        } catch {
          this.messageService.add({ severity: 'error', summary: 'Erreur casier', detail: `Impossible d'ouvrir le casier ${this.activeLocker} pour dépôt.` });
        }
      }
      this.scanMode = null;
      await this.updateAvailableStocks();
      await this.loadLastCheckDates();
      await this.historyService.refreshHistory();
      this.loadBorrowers();
      this.buildProductFilters();
      this.buildLockersMapAndStats();
    }
  }

  private async processWithdrawScan(stock: any): Promise<void> {
    this.history.type = 'withdraw'; this.stock.id = stock.id;
    this.review = stock; this.isStockSelected = true;
    this.getLatestDate();
    await this.addScan('withdraw');
  }

  private async processDepositScan(stock: any): Promise<void> {
    this.history.type = 'deposit'; this.stock.id = stock.id;
    this.review = stock; this.isStockSelected = true;
    this.getLatestDate();
    await this.addScan('deposit');
  }

  // ── Historique / Statuts ──────────────────────────────────────────────────

  async addScan(type: string): Promise<void> {
    const appUser = this.authApp.getCurrentUser();
    if (!appUser) {
      this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Vous devez être connecté.' });
      return;
    }
    this.isButtonEnabled      = false;
    this.history.date         = new Date().toISOString();
    this.history.user.id      = appUser.id;
    this.history.stock.id     = this.stock.id;
    this.history.type         = type;

    try {
      await this.scanService.createHistory(this.history);
      this.showAddToast();
      await this.scanService.refreshData();
      await this.updateAvailableStocks();
      await this.loadLastCheckDates();
      await this.historyService.refreshHistory();
      this.loadBorrowers();
      this.buildProductFilters();
      this.buildLockersMapAndStats();
    } catch {}

    this.stock.id = ''; this.history.stock.id = '';
    this.isStockSelected = false; this.isButtonEnabled = true;
  }

  async updateAvailableStocks(): Promise<void> { await this.loadStocks(); }

  getLatestDate(): void {
    this.stockService.getCheckIdByStockId(this.stock.id).subscribe({
      next: checks => {
        if (checks.length > 0) {
          const latestCheck = checks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          this.review.lastCheckDate = new Date(latestCheck.date).toLocaleString();
        } else {
          this.review.lastCheckDate = 'Aucune donnée disponible';
        }
      },
      error: () => {}
    });
  }

  // ── Toasts ────────────────────────────────────────────────────────────────

  showAddToast(): void {
    this.messageService.add({ severity: 'success', summary: 'Succès', detail: "L'opération a été enregistrée" });
  }

  protected readonly faBarcode = faBarcode;
}
