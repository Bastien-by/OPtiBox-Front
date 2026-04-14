import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import {
  faListCheck, faFileExcel, faDoorOpen, faBarcode,
  faStop, faShieldAlt, faUser, faChevronLeft, faBoxesStacked
} from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { CheckService } from '../../services/check.service';
import { StockService } from '../../services/stock.service';
import { AuthAppService } from '../../services/auth-app.service';
import { PdfService, CheckPdfData } from '../../services/pdf.service';
import { ScanService } from '../../services/scan.service';
import { ExcelService } from '../../services/excel.service';
import { HttpClient } from '@angular/common/http';

interface Product {
  title: string;
  type: string;
  size: string;
  cmu: string;
  location: string;
  picture: string;
  brand: string;
}

interface Stock {
  reference: string;
  id: number;
  alitracer: string;
  lockerNumber: number | null;
  status: number | null;
  lastCheckDate: string | null;
  lastRegulatoryCheckDate: string | null;
  product: Product;
}

interface LockerStats {
  withStock: number;
  empty: number;
  total: number;
}

interface LockerInfo {
  hasStock: boolean;
}

interface MonthData {
  name: string;
  filename: string;
  file: any | null;
  month: number;
  isCurrent: boolean;
  isPast: boolean;
}

interface ProductFilter {
  title: string;
  picture: string;
}

@Component({
  selector: 'app-checkpage',
  standalone: true,
  imports: [
    NgForOf, NgIf, NgClass, DatePipe,
    ReactiveFormsModule, FormsModule,
    ToastModule, DialogModule,
    FaIconComponent, RouterLink
  ],
  templateUrl: './checkpage.component.html',
  styleUrls: ['./checkpage.component.css'],
  providers: [MessageService]
})
export class CheckpageComponent implements OnInit, OnDestroy {

  allStocks: Stock[] = [];
  lockersMap: { [lockerNumber: number]: LockerInfo | undefined } = {};
  stats: LockerStats = { withStock: 0, empty: 0, total: 24 };
  dataReady = false;

  productFilters: ProductFilter[] = [];
  activeFilterTitle: string | null = null;
  filteredLockers: number[] = Array.from({ length: 24 }, (_, i) => i + 1);

  activeLocker: number | null = null;
  lockerStocks: Stock[] = [];
  lockerDetailsDialogVisible = false;

  wallDetailsDialogVisible = false;
  wallStocks: Stock[] = [];

  selectedStockForCheck: Stock | null = null;
  checkComment = '';
  checkDialogVisible = false;
  lockerCloseDialogVisible = false;

  monthlyExcelFiles: any[] = [];
  selectedYear: number | null = null;
  yearDetailDialogVisible = false;

  scanDialogVisible = false;
  globalControlMode = false;
  isTotalControlMode = false;
  pendingCheckType: 'REGULATORY' | 'INDIVIDUAL' = 'INDIVIDUAL';

  lockersOpenedForControl: number[] = [];
  expectedAlitracers: string[] = [];
  lockerOpenProgress = '';

  manualSuffix = '';
  manualScanError = '';
  protected isProcessing = false;

  hsWarningDialogVisible = false;
  hsWarningStock: Stock | null = null;

  recentActions: { action: string; locker: number; time: Date }[] = [];
  private readonly PLC_POLLING_DELAY = 800;
  private actionTimeout: any;
  private pollingInterval: any;

  protected readonly faListCheck = faListCheck;
  protected readonly faFileExcel = faFileExcel;
  protected readonly faDoorOpen = faDoorOpen;
  protected readonly faBarcode = faBarcode;
  protected readonly faStop = faStop;
  protected readonly faShieldAlt = faShieldAlt;
  protected readonly faUser = faUser;
  protected readonly faChevronLeft = faChevronLeft;
  protected readonly faBoxesStacked = faBoxesStacked;

  constructor(
    private checkService: CheckService,
    private messageService: MessageService,
    private stockService: StockService,
    private authApp: AuthAppService,
    private pdfService: PdfService,
    private scanService: ScanService,
    private httpClient: HttpClient,
    private excelService: ExcelService
  ) {
    for (let num = 1; num <= 24; num++) this.lockersMap[num] = { hasStock: false };
  }

  get stocksWithoutLocker(): Stock[] {
    return this.allStocks.filter(s => !s.lockerNumber || s.lockerNumber === 0);
  }

  get totalAvailableStocks(): number {
    return this.allStocks.length;
  }

  get availableYears(): number[] {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current - i);
  }

  get hasPartialRegulatoryControl(): boolean {
    const withStock = this.allStocks.filter(s => (s.lockerNumber ?? 0) > 0);
    if (withStock.length === 0) return false;
    const done = withStock.filter(s => this.isStockCheckedRegulatoryThisMonth(s)).length;
    return done > 0 && done < withStock.length;
  }

  get globalControlLabel(): string {
    return this.hasPartialRegulatoryControl ? 'Finir le Contrôle Réglementaire' : 'Contrôle Réglementaire';
  }

  get isWallFullyCheckedThisMonth(): boolean {
    return this.stocksWithoutLocker.length > 0
      && this.stocksWithoutLocker.every(s => this.isStockCheckedRegulatoryThisMonth(s));
  }

  async ngOnInit(): Promise<void> {
    this.dataReady = false;
    await this.loadLockers();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
    await this.loadProductFilters();
    await this.loadMonthlyExcelFiles();
    this.dataReady = true;
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  isLoggedIn() { return this.authApp.isLoggedIn(); }
  isAdmin() { return this.authApp.isAdmin(); }
  isMaintenance() { return this.authApp.isMaintenance(); }

  get currentUserName(): string {
    const user = this.authApp.getCurrentUser();
    return user ? user.username : 'Utilisateur';
  }

  private async loadLockers(): Promise<void> {
    await this.checkService.refreshStocks();
    const rawStocks: any[] = this.checkService.getStocks();
    this.allStocks = rawStocks.map(s => ({
      id: s.id,
      alitracer: s.alitracer,
      lockerNumber: s.lockerNumber ?? null,
      reference: s.reference,
      status: s.status,
      lastCheckDate: null,
      lastRegulatoryCheckDate: null,
      product: {
        title: s.product.title,
        type: s.product.type,
        size: s.product.size,
        cmu: s.product.cmu,
        location: s.product.location,
        picture: s.product.picture,
        brand: s.product.brand
      }
    }));
  }

  private async loadLastCheckDates(): Promise<void> {
    return new Promise<void>(resolve => {
      this.stockService.getAllChecksByStocks().subscribe({
        next: (grouped) => {
          for (const stock of this.allStocks) {
            const checks: any[] = grouped[stock.id] ?? [];
            if (checks.length === 0) {
              stock.lastCheckDate = null;
              stock.lastRegulatoryCheckDate = null;
              continue;
            }
            const sorted = [...checks].sort((a, b) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            stock.lastCheckDate = this.formatDate(new Date(sorted[0].date));

            const regulatory = checks.filter(c => this.isRegulatoryCheck(c));
            if (regulatory.length > 0) {
              const latestReg = [...regulatory].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
              )[0];
              stock.lastRegulatoryCheckDate = this.formatDate(new Date(latestReg.date));
            } else {
              stock.lastRegulatoryCheckDate = null;
            }
          }
          resolve();
        },
        error: () => {
          for (const stock of this.allStocks) {
            stock.lastCheckDate = null;
            stock.lastRegulatoryCheckDate = null;
          }
          resolve();
        }
      });
    });
  }

  private isRegulatoryCheck(c: any): boolean {
    const ct: string | null | undefined = c.checkType ?? c.type ?? null;
    return ct !== 'INDIVIDUAL';
  }

  private buildLockersMapAndStats(): void {
    const map: { [lockerNumber: number]: LockerInfo } = {};
    let withStock = 0, empty = 0;
    for (let num = 1; num <= 24; num++) {
      const hasStock = this.getStocksByLocker(num).length > 0;
      map[num] = { hasStock };
      if (hasStock) withStock++; else empty++;
    }
    this.lockersMap = map;
    this.stats = { withStock, empty, total: 24 };
    this.setFilter(this.activeFilterTitle);
  }

  async refreshLockers(): Promise<void> {
    this.dataReady = false;
    await this.loadLockers();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
    await this.loadProductFilters();
    await this.loadMonthlyExcelFiles();
    this.dataReady = true;
  }

  private async loadProductFilters(): Promise<void> {
    try {
      const procs = await this.httpClient.get<any[]>('api/procedures').toPromise() ?? [];
      const usedTitles = new Set(this.allStocks.map(s => s.product.title));
      const seen = new Set<string>();
      this.productFilters = procs
        .filter(p => p.title && usedTitles.has(p.title) && !seen.has(p.title) && seen.add(p.title))
        .map(p => ({ title: p.title as string, picture: (p.picture as string) ?? '' }));
    } catch {
      const seen = new Set<string>();
      this.productFilters = [];
      for (const s of this.allStocks) {
        if ((s.lockerNumber ?? 0) > 0 && !seen.has(s.product.title)) {
          seen.add(s.product.title);
          this.productFilters.push({ title: s.product.title, picture: s.product.picture ?? '' });
        }
      }
    }
  }

  setFilter(title: string | null): void {
    this.activeFilterTitle = title;
    if (!title) {
      this.filteredLockers = Array.from({ length: 24 }, (_, i) => i + 1);
      return;
    }
    this.filteredLockers = [...new Set(
      this.allStocks
        .filter(s => s.product.title === title && (s.lockerNumber ?? 0) > 0)
        .map(s => s.lockerNumber as number)
    )];
  }

  getCol(nums: number[]): number[] {
    return nums.filter(n => this.filteredLockers.includes(n));
  }

  getLockerCountByTitle(title: string): number {
    return new Set(
      this.allStocks
        .filter(s => s.product.title === title && (s.lockerNumber ?? 0) > 0)
        .map(s => s.lockerNumber as number)
    ).size;
  }

  getStocksByLocker(lockerNumber: number): Stock[] {
    return this.allStocks.filter(s => s.lockerNumber === lockerNumber);
  }

  getWallStocks(): Stock[] {
    return this.stocksWithoutLocker;
  }

  getAlitracerList(stock: Stock): string[] {
    return StockService.getAlitracerList(stock);
  }

  getLockerCheckRatio(lockerNumber: number): string {
    const stocks = this.getStocksByLocker(lockerNumber);
    if (stocks.length === 0) return '';
    const done = stocks.filter(s => this.isStockCheckedRegulatoryThisMonth(s)).length;
    return `${done}/${stocks.length}`;
  }

  getWallCheckRatio(): string {
    const stocks = this.stocksWithoutLocker;
    if (stocks.length === 0) return '';
    const done = stocks.filter(s => this.isStockCheckedRegulatoryThisMonth(s)).length;
    return `${done}/${stocks.length}`;
  }

  openLockerDetails(lockerNumber: number): void {
    this.activeLocker = lockerNumber;
    this.lockerStocks = this.getStocksByLocker(lockerNumber);
    this.lockerDetailsDialogVisible = true;
  }

  openWallDetails(): void {
    this.wallStocks = [...this.stocksWithoutLocker];
    this.wallDetailsDialogVisible = true;
  }

  wallNeedsCheck(): boolean {
    const stocks = this.stocksWithoutLocker;
    return stocks.length > 0 && stocks.some(s => !this.isStockCheckedRegulatoryThisMonth(s));
  }

  wallMatchesActiveFilter(): boolean {
    return true;
  }

  needsCheck(lockerNumber: number): boolean {
    const stocks = this.getStocksByLocker(lockerNumber);
    if (stocks.length === 0) return false;
    return stocks.some(s => !this.isStockCheckedRegulatoryThisMonth(s));
  }

  isLockerFullyCheckedRegulatoryThisMonth(lockerNumber: number): boolean {
    const stocks = this.getStocksByLocker(lockerNumber);
    if (stocks.length === 0) return false;
    return stocks.every(s => this.isStockCheckedRegulatoryThisMonth(s));
  }

  isWallFullyCheckedRegulatoryThisMonth(): boolean {
    const stocks = this.stocksWithoutLocker;
    if (stocks.length === 0) return false;
    return stocks.every(s => this.isStockCheckedRegulatoryThisMonth(s));
  }

  isStockCheckedRegulatoryThisMonth(stock: Stock): boolean {
    return this.isDateThisMonth(stock.lastRegulatoryCheckDate);
  }

  isStockCheckedThisMonth(stock: Stock): boolean {
    return this.isDateThisMonth(stock.lastCheckDate);
  }

  private isDateThisMonth(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const parts = dateStr.split(/[\\s/:-]/);
    if (parts.length < 3) return false;
    const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  private getLockersNeedingRegulatoryCheck(): number[] {
    const result: number[] = [];
    for (let num = 1; num <= 24; num++) {
      const stocks = this.getStocksByLocker(num);
      if (stocks.length > 0 && !this.isLockerFullyCheckedRegulatoryThisMonth(num)) result.push(num);
    }
    return result;
  }

  getStatusClass(stock: any): string {
    if (stock.status === 1) return 'text-green-500 font-bold';
    if (stock.status === 0) return 'text-black font-bold';
    if (stock.status === 2) return 'text-red-600 font-bold';
    return 'text-gray-500';
  }

  getStatusLabelFromStock(stock: Stock): string {
    if (stock.status === 1) return 'OK';
    if (stock.status === 0) return 'NOK';
    if (stock.status === 2) return 'HS';
    return 'Inconnu';
  }

  getStatusClassFromStock(stock: Stock): string {
    switch (stock.status) {
      case 1: return 'text-green-500 font-bold';
      case 0: return 'text-orange-500 font-bold';
      case 2: return 'text-red-600 font-bold';
      default: return 'text-gray-500';
    }
  }

  private async loadMonthlyExcelFiles(): Promise<void> {
    try { this.monthlyExcelFiles = await this.excelService.getMonthlyFiles(); } catch {}
  }

  getFilesByYear(year: number): any[] {
    return this.monthlyExcelFiles.filter(f => f.filename.includes(`_${year}.xlsx`));
  }

  getMonthsForYear(year: number): MonthData[] {
    const MONTHS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    const now = new Date();
    return MONTHS.map((name, index) => {
      const filename = `Controle_${name}_${year}.xlsx`;
      const file = this.monthlyExcelFiles.find(f => f.filename === filename) ?? null;
      return {
        name, filename, file, month: index + 1,
        isCurrent: year === now.getFullYear() && index === now.getMonth(),
        isPast: new Date(year, index + 1, 0) < new Date(now.getFullYear(), now.getMonth(), 1)
      };
    });
  }

  openYearDetail(year: number): void {
    this.selectedYear = year;
    this.yearDetailDialogVisible = true;
  }

  async downloadCurrentMonthExcel(): Promise<void> {
    const now = new Date();
    const MONTHS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    await this.downloadMonthlyExcel(`Controle_${MONTHS[now.getMonth()]}_${now.getFullYear()}.xlsx`);
  }

  async downloadMonthlyExcel(filename: string): Promise<void> {
    try {
      const blob = await this.excelService.downloadMonthlyExcel(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      window.URL.revokeObjectURL(url);
      this.messageService.add({
        severity: 'success', summary: 'Téléchargement réussi',
        detail: `${filename} téléchargé.`
      });
    } catch {
      this.showErrorToast('Erreur lors du téléchargement');
    }
  }

  private async updateMonthlyExcel(stock: Stock, status: number, comment: string, username: string): Promise<void> {
    try {
      await this.excelService.updateMonthlyExcel({
        alitracer: stock.alitracer,
        size: stock.product.size,
        cmu: stock.product.cmu,
        lockerNumber: stock.lockerNumber,
        status,
        comment,
        controlledBy: username,
        date: new Date().toISOString()
      });
    } catch {}
  }

  async startGlobalControl(): Promise<void> {
    const lockersNeeding = this.getLockersNeedingRegulatoryCheck();
    if (lockersNeeding.length === 0) {
      this.messageService.add({
        severity: 'success',
        summary: 'Contrôles réglementaires à jour',
        detail: 'Tous les casiers ont déjà été contrôlés réglementairement ce mois-ci. ✅'
      });
      return;
    }
    this.stopPolling();
    this.lockerOpenProgress = '...';
    this.messageService.add({
      severity: 'info',
      summary: 'Ouverture en cours',
      detail: `Envoi batch vers ${lockersNeeding.length} casier(s)...`
    });
    try {
      const result = await new Promise<{ requested: number[]; succeeded: number[]; failed: number[] }>(
        (resolve, reject) => this.scanService.openLockers(lockersNeeding)
          .subscribe({ next: resolve, error: reject })
      );
      this.lockerOpenProgress = '';
      this.lockersOpenedForControl = result.succeeded;
      if (result.succeeded.length === 0) {
        this.showErrorToast("Aucun casier n'a pu être ouvert.");
        return;
      }
      if (result.failed.length > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Ouverture partielle',
          detail: `${result.succeeded.length}/${lockersNeeding.length} ouvert(s). Ignorés : ${result.failed.join(', ')}.`
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Casiers ouverts',
          detail: `${result.succeeded.length} casier(s) ouvert(s).`
        });
      }
      result.succeeded.forEach(n => this.addRecentAction('Ouverture réglementaire', n));
    } catch {
      this.lockerOpenProgress = '';
      this.showErrorToast("Erreur lors de l'ouverture des casiers");
      return;
    }

    this.expectedAlitracers = this.allStocks
      .filter(s => (s.lockerNumber ?? 0) > 0 && this.lockersOpenedForControl.includes(s.lockerNumber as number) && !this.isStockCheckedRegulatoryThisMonth(s))
      .flatMap(s => StockService.getAlitracerList(s));

    this.expectedAlitracers.push(
      ...this.stocksWithoutLocker
        .filter(s => !this.isStockCheckedRegulatoryThisMonth(s))
        .flatMap(s => StockService.getAlitracerList(s))
    );

    this.globalControlMode = true;
    this.isTotalControlMode = false;
    this.activeLocker = null;
    this.scanDialogVisible = true;
    await new Promise(r => setTimeout(r, this.PLC_POLLING_DELAY));
    this.startPolling();
  }

  async startTotalControl(): Promise<void> {
    this.stopPolling();
    this.lockersOpenedForControl = [];
    const lockersWithStock: number[] = [];
    for (let num = 1; num <= 24; num++) {
      if (this.getStocksByLocker(num).length > 0) lockersWithStock.push(num);
    }
    if (lockersWithStock.length > 0) {
      this.lockerOpenProgress = '...';
      this.messageService.add({
        severity: 'info',
        summary: 'Ouverture en cours',
        detail: `Ouverture de ${lockersWithStock.length} casier(s)...`
      });
      try {
        const result = await new Promise<{ requested: number[]; succeeded: number[]; failed: number[] }>(
          (resolve, reject) => this.scanService.openLockers(lockersWithStock)
            .subscribe({ next: resolve, error: reject })
        );
        this.lockerOpenProgress = '';
        this.lockersOpenedForControl = result.succeeded;
        result.succeeded.forEach(n => this.addRecentAction('Ouverture Tout Contrôler', n));
        if (result.failed.length > 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Ouverture partielle',
            detail: `${result.succeeded.length}/${lockersWithStock.length} ouvert(s). Ignorés : ${result.failed.join(', ')}.`
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Casiers ouverts',
            detail: `${result.succeeded.length} casier(s) ouvert(s).`
          });
        }
      } catch {
        this.lockerOpenProgress = '';
        this.showErrorToast("Erreur lors de l'ouverture des casiers");
        return;
      }
    }

    this.expectedAlitracers = this.allStocks.flatMap(s => StockService.getAlitracerList(s));

    this.globalControlMode = false;
    this.isTotalControlMode = true;
    this.activeLocker = null;
    this.scanDialogVisible = true;
    await new Promise(r => setTimeout(r, this.PLC_POLLING_DELAY));
    this.startPolling();
  }

  async startScanControl(): Promise<void> {
    if (!this.activeLocker) { this.showErrorToast('Aucun casier sélectionné'); return; }
    if (this.lockerStocks.length === 0) { this.showErrorToast('Aucun stock à contrôler dans ce casier'); return; }
    try {
      await this.scanService.openLocker(this.activeLocker);
      this.addRecentAction('Ouverture individuelle', this.activeLocker);
      this.messageService.add({
        severity: 'info',
        summary: 'Casier ouvert',
        detail: `Casier ${this.activeLocker} ouvert. Contrôle individuel démarré.`
      });
      this.globalControlMode = false;
      this.isTotalControlMode = false;
      this.expectedAlitracers = this.lockerStocks.flatMap(s => StockService.getAlitracerList(s));
      this.lockerDetailsDialogVisible = false;
      this.scanDialogVisible = true;
      this.startPolling();
    } catch {
      this.showErrorToast(`Impossible d'ouvrir le casier ${this.activeLocker}`);
    }
  }

  startWallScanControl(): void {
    this.wallDetailsDialogVisible = false;
    this.activeLocker = null;
    this.lockerStocks = [...this.stocksWithoutLocker];
    this.expectedAlitracers = this.lockerStocks.flatMap(s => StockService.getAlitracerList(s));
    this.globalControlMode = false;
    this.isTotalControlMode = false;
    this.checkComment = '';
    this.manualSuffix = '';
    this.manualScanError = '';
    this.scanDialogVisible = true;
    this.startPolling();
  }

  async stopScanControl(): Promise<void> {
    this.stopPolling();
    this.scanDialogVisible = false;

    // Mode réglementaire ou "Tout Contrôler" : fermer les casiers batch
    if ((this.globalControlMode || this.isTotalControlMode) && this.lockersOpenedForControl.length > 0) {
      this.lockerCloseDialogVisible = true;
    } else if (this.activeLocker !== null) {
      // Mode casier individuel
      this.lockerCloseDialogVisible = true;
    } else {
      // Mode mur seul : pas de casier à fermer
      this.resetControlState();
      await this.refreshLockers();
    }
  }

  async confirmLockerClosed(): Promise<void> {
    this.lockerCloseDialogVisible = false;
    if (this.globalControlMode || this.isTotalControlMode) {
      this.messageService.add({
        severity: 'info',
        summary: 'Fermeture en cours',
        detail: 'Fermeture des casiers contrôlés...'
      });
      try {
        const result = await new Promise<{ requested: number[]; succeeded: number[]; failed: number[] }>(
          (resolve, reject) => this.scanService.closeLockers(this.lockersOpenedForControl)
            .subscribe({ next: resolve, error: reject })
        );
        result.succeeded.forEach(n => this.addRecentAction('Fermeture', n));
        if (result.failed.length > 0) {
          this.messageService.add({
            severity: 'warn',
            summary: 'Fermeture partielle',
            detail: `Casiers non fermés : ${result.failed.join(', ')}.`
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Casiers fermés',
            detail: `${result.succeeded.length} casier(s) fermé(s).`
          });
        }
      } catch {
        this.showErrorToast('Erreur lors de la fermeture des casiers');
      }
      this.lockersOpenedForControl = [];
    } else if (this.activeLocker !== null) {
      try {
        await this.scanService.closeLocker(this.activeLocker);
        this.addRecentAction('Fermeture individuelle', this.activeLocker);
        this.messageService.add({
          severity: 'success',
          summary: 'Casier fermé',
          detail: `Casier ${this.activeLocker} fermé.`
        });
      } catch {
        this.showErrorToast(`Impossible de fermer le casier ${this.activeLocker}`);
      }
    }
    this.resetControlState();
    await this.refreshLockers();
  }

  private resetControlState(): void {
    this.activeLocker = null;
    this.selectedStockForCheck = null;
    this.globalControlMode = false;
    this.isTotalControlMode = false;
    this.pendingCheckType = 'INDIVIDUAL';
    this.messageService.add({
      severity: 'info',
      summary: 'Contrôle terminé',
      detail: 'Le mode de contrôle a été arrêté.'
    });
  }

  private startPolling(): void {
    this.scanService.clearScan();
    this.pollingInterval = setInterval(async () => {
      if (this.isProcessing) return;
      try {
        const response = await this.scanService.readScan();
        if (response?.success && response?.value) {
          const val = response.value.trim();
          if (val !== '') {
            this.isProcessing = true;
            await this.handleScannedCode(val);
          }
        }
      } catch {
        this.isProcessing = false;
      }
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isProcessing = false;
  }

  submitManualScan(): void {
    const suffix = this.manualSuffix.trim();
    if (!/^\d{4}$/.test(suffix)) {
      this.manualScanError = 'Saisissez exactement 4 chiffres.';
      return;
    }
    this.manualScanError = '';
    this.manualSuffix = '';
    this.isProcessing = true;
    this.handleScannedCode('L000000' + suffix);
  }

  private async handleScannedCode(decodedText: string): Promise<void> {
    try {
      const alitracer = decodedText.trim();
      if (this.expectedAlitracers.length > 0 && !this.expectedAlitracers.includes(alitracer)) {
        this.messageService.add({
          severity: 'error',
          summary: 'Alitracer non attendu',
          detail: this.globalControlMode
            ? "Ce code n'est pas dans la liste des stocks à contrôler réglementairement."
            : this.isTotalControlMode
              ? "Ce code n'est pas dans la liste des stocks à contrôler."
              : this.activeLocker !== null
                ? `Ce code ne fait pas partie du casier ${this.activeLocker}.`
                : "Ce code ne fait pas partie des stocks hors casier."
        });
        return;
      }
      const stock = StockService.findByAlitracer(this.allStocks, alitracer);
      if (!stock) {
        this.messageService.add({
          severity: 'error',
          summary: 'Stock introuvable',
          detail: "Aucun stock trouvé pour l'ID Alitracer scanné."
        });
        return;
      }
      this.pendingCheckType = this.globalControlMode ? 'REGULATORY' : 'INDIVIDUAL';
      this.selectedStockForCheck = stock;
      this.checkComment = '';
      this.checkDialogVisible = true;
      this.stopPolling();
    } catch {
      this.showErrorToast('Une erreur est survenue lors du traitement du scan.');
    } finally {
      await this.scanService.clearScan();
      await new Promise(r => setTimeout(r, 1000));
      this.isProcessing = false;
    }
  }

  confirmCheck(status: number): void {
    this.checkDialogVisible = false;
    this.executeCheck(status);
  }

  private async executeCheck(status: number): Promise<void> {
    if (!this.selectedStockForCheck) { this.showErrorToast('Aucun produit sélectionné'); return; }
    const appUser = this.authApp.getCurrentUser();
    if (!appUser) { this.showErrorToast('Vous devez être connecté pour réaliser un contrôle'); return; }

    const checkType = this.pendingCheckType;
    const checkDate = new Date().toISOString();
    const payload: any = {
      id: null, date: checkDate, status,
      comment: this.checkComment || '', checkType,
      user: { id: appUser.id }, stock: { id: this.selectedStockForCheck.id }
    };

    try {
      const savedCheck: any = await this.checkService.createCheck(payload);

      const pdfData: CheckPdfData = {
        checkDate,
        productName: this.selectedStockForCheck.product?.title || 'Produit inconnu',
        alitracer: this.selectedStockForCheck.alitracer || '',
        reference: this.selectedStockForCheck.reference || '',
        lockerNumber: this.selectedStockForCheck.lockerNumber ?? 0,
        status,
        comment: this.checkComment || '',
        controlledBy: appUser.username,
        brand: this.selectedStockForCheck.product?.brand || 'N/A',
        cmu: this.selectedStockForCheck.product?.cmu || 'N/A',
        size: this.selectedStockForCheck.product?.size || 'N/A'
      };

      const pdfResult: any = await this.pdfService.generateAndSavePdf(pdfData);
      if (pdfResult?.filename) {
        await this.httpClient.patch(`api/checks/${savedCheck.id}/pdf`, {}, { params: { filename: pdfResult.filename } }).toPromise();
      }

      if (checkType === 'REGULATORY') {
        await this.updateMonthlyExcel(this.selectedStockForCheck, status, this.checkComment, appUser.username);
      }

      const formatted = this.formatDate(new Date());
      this.selectedStockForCheck.status = status;
      this.selectedStockForCheck.lastCheckDate = formatted;

      const alitracersOfStock = StockService.getAlitracerList(this.selectedStockForCheck);

      if (checkType === 'REGULATORY') {
        this.selectedStockForCheck.lastRegulatoryCheckDate = formatted;
        this.expectedAlitracers = this.expectedAlitracers.filter(a => !alitracersOfStock.includes(a));
      } else if (this.isTotalControlMode || this.activeLocker === null) {
        this.expectedAlitracers = this.expectedAlitracers.filter(a => !alitracersOfStock.includes(a));
      }

      const inList = this.allStocks.find(s => s.id === this.selectedStockForCheck!.id);
      if (inList) {
        inList.status = status;
        inList.lastCheckDate = formatted;
        if (checkType === 'REGULATORY') inList.lastRegulatoryCheckDate = formatted;
      }

      this.buildLockersMapAndStats();
      if (checkType === 'REGULATORY') await this.loadMonthlyExcelFiles();
      this.showAddToast(checkType);

      if (status === 2) {
        try {
          await this.httpClient.patch(`api/stocks/${this.selectedStockForCheck.id}/withdraw`, {}).toPromise();
        } catch (e) {
          console.error('Erreur lors du retrait du stock HS :', e);
        }

        const inListHS = this.allStocks.find(s => s.id === this.selectedStockForCheck!.id);
        if (inListHS) inListHS.lockerNumber = 0;
        this.selectedStockForCheck.lockerNumber = 0;
        this.buildLockersMapAndStats();

        this.hsWarningStock = this.selectedStockForCheck;
        this.selectedStockForCheck = null;
        this.checkComment = '';
        this.hsWarningDialogVisible = true;
        return;
      }

      this.selectedStockForCheck = null;
      this.checkComment = '';

      const isMultiMode = this.globalControlMode || this.isTotalControlMode || this.activeLocker === null;
      if (isMultiMode && this.expectedAlitracers.length === 0) {
        this.messageService.add({
          severity: 'success',
          summary: this.globalControlMode ? 'Contrôle réglementaire terminé' : 'Tout contrôlé',
          detail: this.globalControlMode
            ? 'Tous les stocks ont été contrôlés réglementairement ce mois-ci. ✅'
            : 'Tous les stocks ont été contrôlés. ✅'
        });
        setTimeout(() => this.stopScanControl(), 1500);
        return;
      }

      if (this.scanDialogVisible) {
        this.messageService.add({
          severity: 'info',
          summary: 'Contrôle enregistré',
          detail: 'Vous pouvez scanner le prochain stock.'
        });
        setTimeout(() => this.startPolling(), 500);
      } else {
        await this.refreshLockers();
      }
    } catch {
      this.showErrorToast("Erreur lors de l'enregistrement du contrôle");
    }
  }

  closeHsWarning(): void {
    this.hsWarningDialogVisible = false;
    this.hsWarningStock = null;

    if ((this.globalControlMode || this.isTotalControlMode || this.activeLocker === null)
      && this.expectedAlitracers.length === 0) {
      this.messageService.add({
        severity: 'success',
        summary: this.globalControlMode ? 'Contrôle réglementaire terminé' : 'Tout contrôlé',
        detail: 'Tous les stocks ont été contrôlés. ✅'
      });
      setTimeout(() => this.stopScanControl(), 1500);
      return;
    }

    if (this.scanDialogVisible) {
      setTimeout(() => this.startPolling(), 500);
    }
  }

  showAddToast(checkType: 'REGULATORY' | 'INDIVIDUAL' = 'INDIVIDUAL'): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Contrôle enregistré',
      detail: checkType === 'REGULATORY'
        ? 'Contrôle réglementaire enregistré — ratio et Excel mis à jour.'
        : 'Contrôle individuel enregistré — ratio et Excel non modifiés.'
    });
  }

  showErrorToast(detail = 'Erreur inconnue'): void {
    this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  private addRecentAction(action: string, locker: number): void {
    this.recentActions.unshift({ action, locker, time: new Date() });
    if (this.recentActions.length > 5) this.recentActions = this.recentActions.slice(0, 5);
    if (this.actionTimeout) clearTimeout(this.actionTimeout);
    this.actionTimeout = setTimeout(() => { this.recentActions = []; }, 30000);
  }
}
