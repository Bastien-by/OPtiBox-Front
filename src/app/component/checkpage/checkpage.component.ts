import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

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
  title: string; type: string; size: string; cmu: string;
  location: string; picture: string; brand: string;
}

interface Stock {
  reference: string; id: number; alitracer: string;
  lockerNumber: number; status: number | null;
  lastCheckDate: string | null;
  lastRegulatoryCheckDate: string | null;
  product: Product;
}

interface LockerStats { withStock: number; empty: number; total: number; }
interface LockerInfo  { hasStock: boolean; }
interface MonthData  {
  name: string; filename: string; file: any | null;
  month: number; isCurrent: boolean; isPast: boolean;
}

@Component({
  selector: 'app-checkpage',
  standalone: true,
  imports: [NgForOf, NgIf, NgClass, DatePipe, ReactiveFormsModule, FormsModule,
    ToastModule, DialogModule, FaIconComponent],
  templateUrl: './checkpage.component.html',
  styleUrls: ['./checkpage.component.css'],
  providers: [MessageService]
})
export class CheckpageComponent implements OnInit, OnDestroy {

  allStocks: Stock[] = [];
  lockersMap: { [lockerNumber: number]: LockerInfo | undefined } = {};
  stats: LockerStats = { withStock: 0, empty: 0, total: 24 };
  dataReady = false;

  activeLocker: number | null = null;
  lockerStocks: Stock[] = [];
  lockerDetailsDialogVisible = false;

  selectedStockForCheck: Stock | null = null;
  checkComment = '';
  checkDialogVisible = false;

  lockerCloseDialogVisible = false;
  monthlyExcelFiles: any[] = [];

  get availableYears(): number[] {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => current + i);
  }

  selectedYear: number | null = null;
  yearDetailDialogVisible = false;
  scanDialogVisible = false;

  /**
   * true  = mode RÉGLEMENTAIRE (Excel + ratio mis à jour)
   * false = mode INDIVIDUEL ou TOUT CONTRÔLER (ni Excel ni ratio)
   */
  globalControlMode = false;

  /**
   * true = mode "Tout Contrôler" :
   *   - INDIVIDUAL (pas d'Excel, pas de ratio)
   *   - Ouvre TOUS les casiers avec stock
   *   - Inclut aussi les stocks hors casier (lockerNumber = 0 / null)
   *   - Retire chaque stock de la liste après scan (comme le réglementaire)
   */
  isTotalControlMode = false;

  /**
   * Type gelé au moment du scan dans handleScannedCode.
   * executeCheck lit ce champ, jamais globalControlMode directement.
   */
  pendingCheckType: 'REGULATORY' | 'INDIVIDUAL' = 'INDIVIDUAL';

  lockersOpenedForControl: number[] = [];
  expectedAlitracers: string[] = [];
  lockerOpenProgress = '';
  private readonly PLC_POLLING_DELAY = 800;

  recentActions: { action: string; locker: number; time: Date }[] = [];

  manualSuffix    = '';
  manualScanError = '';
  /** Affiché après un contrôle HS pour demander la destruction de l'objet */
  hsWarningDialogVisible = false;
  /** Stock concerné par le dernier contrôle HS */
  hsWarningStock: Stock | null = null;

  private actionTimeout: any;
  private pollingInterval: any;
  protected isProcessing = false;

  protected readonly faListCheck    = faListCheck;
  protected readonly faFileExcel    = faFileExcel;
  protected readonly faDoorOpen     = faDoorOpen;
  protected readonly faBarcode      = faBarcode;
  protected readonly faStop         = faStop;
  protected readonly faShieldAlt    = faShieldAlt;
  protected readonly faUser         = faUser;
  protected readonly faChevronLeft  = faChevronLeft;
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

  async ngOnInit(): Promise<void> {
    this.dataReady = false;
    await this.loadLockers();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
    await this.loadMonthlyExcelFiles();
    this.dataReady = true;
  }

  ngOnDestroy(): void { this.stopPolling(); }

  isLoggedIn()    { return this.authApp.isLoggedIn(); }
  isAdmin()       { return this.authApp.isAdmin(); }
  isMaintenance() { return this.authApp.isMaintenance(); }

  get currentUserName(): string {
    const user = this.authApp.getCurrentUser();
    return user ? user.username : 'Utilisateur';
  }

  getStatusClass(stock: any): string {
    if (stock.status === 1) return 'text-green-500 font-bold';
    if (stock.status === 0) return 'text-black font-bold';
    if (stock.status === 2) return 'text-red-600 font-bold';
    return 'text-gray-500';
  }

  // ── Chargement ────────────────────────────────────────────────────────────

  private async loadLockers(): Promise<void> {
    await this.checkService.refreshStocks();
    const rawStocks: any[] = this.checkService.getStocks();
    this.allStocks = rawStocks.map(s => ({
      id: s.id, alitracer: s.alitracer, lockerNumber: s.lockerNumber,
      reference: s.reference, status: s.status,
      lastCheckDate: null, lastRegulatoryCheckDate: null,
      product: {
        title: s.product.title, type: s.product.type, size: s.product.size,
        cmu: s.product.cmu, location: s.product.location,
        picture: s.product.picture, brand: s.product.brand
      }
    }));
  }

  private isRegulatoryCheck(c: any): boolean {
    const ct: string | null | undefined = c.checkType ?? c.type ?? null;
    return ct !== 'INDIVIDUAL';
  }

  private async loadLastCheckDates(): Promise<void> {
    return new Promise<void>(resolve => {
      this.stockService.getAllChecksByStocks().subscribe({
        next: (grouped) => {
          for (const stock of this.allStocks) {
            const checks: any[] = grouped[stock.id] ?? [];
            if (checks.length === 0) {
              stock.lastCheckDate = null; stock.lastRegulatoryCheckDate = null; continue;
            }
            const sorted = [...checks].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            stock.lastCheckDate = this.formatDate(new Date(sorted[0].date));
            const regulatory = checks.filter(c => this.isRegulatoryCheck(c));
            if (regulatory.length > 0) {
              const latestReg = [...regulatory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
              stock.lastRegulatoryCheckDate = this.formatDate(new Date(latestReg.date));
            } else {
              stock.lastRegulatoryCheckDate = null;
            }
          }
          resolve();
        },
        error: () => {
          for (const stock of this.allStocks) { stock.lastCheckDate = null; stock.lastRegulatoryCheckDate = null; }
          resolve();
        }
      });
    });
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
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
  }

  async refreshLockers(): Promise<void> {
    this.dataReady = false;
    await this.loadLockers();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
    await this.loadMonthlyExcelFiles();
    this.dataReady = true;
  }

  // ── Helpers casiers ───────────────────────────────────────────────────────

  getStocksByLocker(lockerNumber: number): Stock[] {
    return this.allStocks.filter(s => s.lockerNumber === lockerNumber);
  }

  /** Stocks sans casier (retirés, hors casier) */
  get stocksWithoutLocker(): Stock[] {
    return this.allStocks.filter(s => !s.lockerNumber || s.lockerNumber === 0);
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

  openLockerDetails(lockerNumber: number): void {
    this.activeLocker   = lockerNumber;
    this.lockerStocks   = this.getStocksByLocker(lockerNumber);
    this.lockerDetailsDialogVisible = true;
  }

  get totalAvailableStocks(): number { return this.allStocks.length; }

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

  isStockCheckedRegulatoryThisMonth(stock: Stock): boolean { return this.isDateThisMonth(stock.lastRegulatoryCheckDate); }
  isStockCheckedThisMonth(stock: Stock):            boolean { return this.isDateThisMonth(stock.lastCheckDate); }

  private isDateThisMonth(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const parts = dateStr.split(/[\s/:]/);
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

  get hasPartialRegulatoryControl(): boolean {
    const withStock = this.allStocks.filter(s => s.lockerNumber > 0);
    if (withStock.length === 0) return false;
    const done = withStock.filter(s => this.isStockCheckedRegulatoryThisMonth(s)).length;
    return done > 0 && done < withStock.length;
  }

  get globalControlLabel(): string {
    return this.hasPartialRegulatoryControl ? 'Finir le Contrôle Réglementaire' : 'Contrôle Réglementaire';
  }

  // ── Excel mensuel ─────────────────────────────────────────────────────────

  private async loadMonthlyExcelFiles(): Promise<void> {
    try { this.monthlyExcelFiles = await this.excelService.getMonthlyFiles(); } catch {}
  }

  getFilesByYear(year: number): any[] {
    return this.monthlyExcelFiles.filter(f => f.filename.includes(`_${year}.xlsx`));
  }

  getMonthsForYear(year: number): MonthData[] {
    const MONTHS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin',
      'Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    const now = new Date();
    return MONTHS.map((name, index) => {
      const filename = `Controle_${name}_${year}.xlsx`;
      const file     = this.monthlyExcelFiles.find(f => f.filename === filename) ?? null;
      return {
        name, filename, file, month: index + 1,
        isCurrent: year === now.getFullYear() && index === now.getMonth(),
        isPast: new Date(year, index + 1, 0) < new Date(now.getFullYear(), now.getMonth(), 1)
      };
    });
  }

  openYearDetail(year: number): void { this.selectedYear = year; this.yearDetailDialogVisible = true; }

  async downloadCurrentMonthExcel(): Promise<void> {
    const now = new Date();
    const MONTHS = ['Janvier','Fevrier','Mars','Avril','Mai','Juin',
      'Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];
    await this.downloadMonthlyExcel(`Controle_${MONTHS[now.getMonth()]}_${now.getFullYear()}.xlsx`);
  }

  async downloadMonthlyExcel(filename: string): Promise<void> {
    try {
      const blob = await this.excelService.downloadMonthlyExcel(filename);
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      window.URL.revokeObjectURL(url);
      this.messageService.add({ severity: 'success', summary: 'Téléchargement réussi', detail: `${filename} téléchargé.` });
    } catch { this.showErrorToast('Erreur lors du téléchargement'); }
  }

  private async updateMonthlyExcel(stock: Stock, status: number, comment: string, username: string): Promise<void> {
    try {
      await this.excelService.updateMonthlyExcel({
        alitracer: stock.alitracer, size: stock.product.size, cmu: stock.product.cmu,
        lockerNumber: stock.lockerNumber, status, comment,
        controlledBy: username, date: new Date().toISOString()
      });
    } catch {}
  }

  // ── Contrôle RÉGLEMENTAIRE global ─────────────────────────────────────────

  async startGlobalControl(): Promise<void> {
    const lockersNeeding = this.getLockersNeedingRegulatoryCheck();
    if (lockersNeeding.length === 0) {
      this.messageService.add({ severity: 'success', summary: 'Contrôles réglementaires à jour',
        detail: 'Tous les casiers ont déjà été contrôlés réglementairement ce mois-ci. ✅' });
      return;
    }
    this.stopPolling();
    this.lockerOpenProgress = '...';
    this.messageService.add({ severity: 'info', summary: 'Ouverture en cours',
      detail: `Envoi batch vers ${lockersNeeding.length} casier(s)...` });
    try {
      const result = await new Promise<{ requested: number[], succeeded: number[], failed: number[] }>((resolve, reject) => {
        this.scanService.openLockers(lockersNeeding).subscribe({ next: res => resolve(res), error: err => reject(err) });
      });
      this.lockerOpenProgress = '';
      this.lockersOpenedForControl = result.succeeded;
      if (result.succeeded.length === 0) { this.showErrorToast("Aucun casier n'a pu être ouvert."); return; }
      if (result.failed.length > 0) {
        this.messageService.add({ severity: 'warn', summary: 'Ouverture partielle',
          detail: `${result.succeeded.length}/${lockersNeeding.length} ouvert(s). Ignorés : ${result.failed.join(', ')}.` });
      } else {
        this.messageService.add({ severity: 'success', summary: 'Casiers ouverts',
          detail: `${result.succeeded.length} casier(s) ouvert(s).` });
      }
      result.succeeded.forEach(n => this.addRecentAction('Ouverture réglementaire', n));
    } catch {
      this.lockerOpenProgress = '';
      this.showErrorToast("Erreur lors de l'ouverture des casiers");
      return;
    }

    this.expectedAlitracers = this.allStocks
      .filter(s => this.lockersOpenedForControl.includes(s.lockerNumber) && !this.isStockCheckedRegulatoryThisMonth(s))
      .flatMap(s => StockService.getAlitracerList(s));

    this.globalControlMode  = true;
    this.isTotalControlMode = false;
    this.activeLocker       = null;
    this.scanDialogVisible  = true;
    await new Promise(r => setTimeout(r, this.PLC_POLLING_DELAY));
    this.startPolling();
  }

  // ── Contrôle TOUT CONTRÔLER (individuel, tous les stocks) ─────────────────

  /**
   * Ouvre TOUS les casiers qui ont du stock, puis propose de scanner
   * TOUS les articles (y compris ceux hors casier).
   * Mode INDIVIDUAL : ne modifie ni Excel ni ratio réglementaire.
   */
  async startTotalControl(): Promise<void> {
    this.stopPolling();
    this.lockersOpenedForControl = [];

    // Ouvre tous les casiers avec stock
    const lockersWithStock: number[] = [];
    for (let num = 1; num <= 24; num++) {
      if (this.getStocksByLocker(num).length > 0) lockersWithStock.push(num);
    }

    if (lockersWithStock.length > 0) {
      this.lockerOpenProgress = '...';
      this.messageService.add({ severity: 'info', summary: 'Ouverture en cours',
        detail: `Ouverture de ${lockersWithStock.length} casier(s)...` });
      try {
        const result = await new Promise<{ requested: number[], succeeded: number[], failed: number[] }>((resolve, reject) => {
          this.scanService.openLockers(lockersWithStock).subscribe({ next: res => resolve(res), error: err => reject(err) });
        });
        this.lockerOpenProgress  = '';
        this.lockersOpenedForControl = result.succeeded;
        result.succeeded.forEach(n => this.addRecentAction('Ouverture Tout Contrôler', n));
        if (result.failed.length > 0) {
          this.messageService.add({ severity: 'warn', summary: 'Ouverture partielle',
            detail: `${result.succeeded.length}/${lockersWithStock.length} ouvert(s). Ignorés : ${result.failed.join(', ')}.` });
        } else {
          this.messageService.add({ severity: 'success', summary: 'Casiers ouverts',
            detail: `${result.succeeded.length} casier(s) ouvert(s).` });
        }
      } catch {
        this.lockerOpenProgress = '';
        this.showErrorToast("Erreur lors de l'ouverture des casiers");
        return;
      }
    }

    // Tous les stocks sans exception (y compris hors casier)
    this.expectedAlitracers = this.allStocks.flatMap(s => StockService.getAlitracerList(s));

    this.globalControlMode  = false;
    this.isTotalControlMode = true;
    this.activeLocker       = null;
    this.scanDialogVisible  = true;
    await new Promise(r => setTimeout(r, this.PLC_POLLING_DELAY));
    this.startPolling();
  }

  // ── Fermeture casier ──────────────────────────────────────────────────────

  async confirmLockerClosed(): Promise<void> {
    this.lockerCloseDialogVisible = false;

    // Fermeture multiple : réglementaire OU tout contrôler
    if (this.globalControlMode || this.isTotalControlMode) {
      this.stopPolling();
      this.messageService.add({ severity: 'info', summary: 'Fermeture en cours',
        detail: 'Fermeture des casiers contrôlés...' });
      try {
        const result = await new Promise<{ requested: number[], succeeded: number[], failed: number[] }>((resolve, reject) => {
          this.scanService.closeLockers(this.lockersOpenedForControl).subscribe({ next: res => resolve(res), error: err => reject(err) });
        });
        result.succeeded.forEach(n => this.addRecentAction('Fermeture', n));
        if (result.failed.length > 0) {
          this.messageService.add({ severity: 'warn', summary: 'Fermeture partielle',
            detail: `Casiers non fermés : ${result.failed.join(', ')}.` });
        } else {
          this.messageService.add({ severity: 'success', summary: 'Casiers fermés',
            detail: `${result.succeeded.length} casier(s) fermé(s).` });
        }
      } catch { this.showErrorToast('Erreur lors de la fermeture des casiers'); }
      this.lockersOpenedForControl = [];

    } else if (this.activeLocker) {
      try {
        await this.scanService.closeLocker(this.activeLocker);
        this.addRecentAction('Fermeture individuelle', this.activeLocker);
        this.messageService.add({ severity: 'success', summary: 'Casier fermé',
          detail: `Casier ${this.activeLocker} fermé.` });
      } catch { this.showErrorToast(`Impossible de fermer le casier ${this.activeLocker}`); }
    }

    // Remise à zéro
    this.activeLocker          = null;
    this.selectedStockForCheck = null;
    this.globalControlMode     = false;
    this.isTotalControlMode    = false;
    this.pendingCheckType      = 'INDIVIDUAL';

    this.messageService.add({ severity: 'info', summary: 'Contrôle terminé',
      detail: 'Le mode de contrôle a été arrêté.' });
    await this.refreshLockers();
  }

  // ── Contrôle INDIVIDUEL (casier unique) ───────────────────────────────────

  async startScanControl(): Promise<void> {
    if (!this.activeLocker) { this.showErrorToast('Aucun casier sélectionné'); return; }
    if (this.lockerStocks.length === 0) { this.showErrorToast('Aucun stock à contrôler dans ce casier'); return; }
    try {
      await this.scanService.openLocker(this.activeLocker);
      this.addRecentAction('Ouverture individuelle', this.activeLocker);
      this.messageService.add({ severity: 'info', summary: 'Casier ouvert',
        detail: `Casier ${this.activeLocker} ouvert. Contrôle individuel démarré.` });
      this.globalControlMode  = false;
      this.isTotalControlMode = false;
      this.expectedAlitracers = this.lockerStocks.flatMap(s => StockService.getAlitracerList(s));
      this.lockerDetailsDialogVisible = false;
      this.scanDialogVisible  = true;
      this.startPolling();
    } catch { this.showErrorToast(`Impossible d'ouvrir le casier ${this.activeLocker}`); }
  }

  async stopScanControl(): Promise<void> {
    this.stopPolling();
    this.scanDialogVisible        = false;
    this.lockerCloseDialogVisible = true;
  }

  // ── Polling douchette ─────────────────────────────────────────────────────

  private startPolling(): void {
    this.scanService.clearScan();
    this.pollingInterval = setInterval(async () => {
      if (this.isProcessing) return;
      try {
        const response = await this.scanService.readScan();
        if (response?.success && response?.value) {
          const val = response.value.trim();
          if (val !== '') { this.isProcessing = true; await this.handleScannedCode(val); }
        }
      } catch { this.isProcessing = false; }
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
    this.isProcessing = false;
  }

  submitManualScan(): void {
    const suffix = this.manualSuffix.trim();
    if (!/^\d{4}$/.test(suffix)) { this.manualScanError = 'Saisissez exactement 4 chiffres.'; return; }
    this.manualScanError = '';
    const alitracer = 'L000000' + suffix;
    this.manualSuffix = '';
    this.isProcessing = true;
    this.handleScannedCode(alitracer);
  }

  private async handleScannedCode(decodedText: string): Promise<void> {
    try {
      const alitracer = decodedText.trim();

      if (this.expectedAlitracers.length > 0 && !this.expectedAlitracers.includes(alitracer)) {
        this.messageService.add({
          severity: 'error', summary: 'Alitracer non attendu',
          detail: this.globalControlMode
            ? "Ce code n'est pas dans la liste des stocks à contrôler réglementairement."
            : this.isTotalControlMode
              ? "Ce code n'est pas dans la liste des stocks à contrôler."
              : `Ce code ne fait pas partie du casier ${this.activeLocker}.`
        });
        return;
      }

      const stock = StockService.findByAlitracer(this.allStocks, alitracer);
      if (!stock) {
        this.messageService.add({ severity: 'error', summary: 'Stock introuvable',
          detail: "Aucun stock trouvé pour l'ID Alitracer scanné." });
        return;
      }

      // Gèle le type au moment du scan
      this.pendingCheckType      = this.globalControlMode ? 'REGULATORY' : 'INDIVIDUAL';
      this.selectedStockForCheck = stock;
      this.checkComment          = '';
      this.checkDialogVisible    = true;
      this.stopPolling();

    } catch { this.showErrorToast('Une erreur est survenue lors du traitement du scan.');
    } finally {
      await this.scanService.clearScan();
      await new Promise(r => setTimeout(r, 1000));
      this.isProcessing = false;
    }
  }

  // ── Enregistrement du contrôle ────────────────────────────────────────────

  confirmCheck(status: number): void { this.checkDialogVisible = false; this.executeCheck(status); }

  private async executeCheck(status: number): Promise<void> {
    if (!this.selectedStockForCheck) { this.showErrorToast('Aucun produit sélectionné'); return; }
    const appUser = this.authApp.getCurrentUser();
    if (!appUser) { this.showErrorToast('Vous devez être connecté pour réaliser un contrôle'); return; }

    // Utilise le type gelé au moment du scan, pas globalControlMode
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
        productName:  this.selectedStockForCheck.product?.title   || 'Produit inconnu',
        alitracer:    this.selectedStockForCheck.alitracer          || '',
        reference:    this.selectedStockForCheck.reference          || '',
        lockerNumber: this.selectedStockForCheck.lockerNumber,
        status, comment: this.checkComment || '', controlledBy: appUser.username,
        brand: this.selectedStockForCheck.product?.brand || 'N/A',
        cmu:   this.selectedStockForCheck.product?.cmu   || 'N/A',
        size:  this.selectedStockForCheck.product?.size  || 'N/A'
      };

      const pdfResult: any = await this.pdfService.generateAndSavePdf(pdfData);
      if (pdfResult?.filename) {
        await this.httpClient.patch(`api/checks/${savedCheck.id}/pdf`, {},
          { params: { filename: pdfResult.filename } }).toPromise();
      }

      // Excel uniquement pour REGULATORY
      if (checkType === 'REGULATORY') {
        await this.updateMonthlyExcel(this.selectedStockForCheck, status, this.checkComment, appUser.username);
      }

      const formatted = this.formatDate(new Date());
      this.selectedStockForCheck.status        = status;
      this.selectedStockForCheck.lastCheckDate = formatted;

      const alitracersOfStock = StockService.getAlitracerList(this.selectedStockForCheck);

      if (checkType === 'REGULATORY') {
        // Ratio + Excel mis à jour
        this.selectedStockForCheck.lastRegulatoryCheckDate = formatted;
        this.expectedAlitracers = this.expectedAlitracers.filter(a => !alitracersOfStock.includes(a));
      } else if (this.isTotalControlMode) {
        // "Tout Contrôler" : retire aussi de la liste pour faire avancer le compteur
        this.expectedAlitracers = this.expectedAlitracers.filter(a => !alitracersOfStock.includes(a));
      }

      const inList = this.allStocks.find(s => s.id === this.selectedStockForCheck!.id);
      if (inList) {
        inList.status        = status;
        inList.lastCheckDate = formatted;
        if (checkType === 'REGULATORY') inList.lastRegulatoryCheckDate = formatted;
      }

      this.buildLockersMapAndStats();
      if (checkType === 'REGULATORY') await this.loadMonthlyExcelFiles();
      this.showAddToast(checkType);

// ── Traitement spécifique HS ───────────────────────────────────────────────
      if (status === 2) {
        try {
          // Retire le stock de son casier côté backend (adapte l'endpoint si besoin)
          await this.httpClient.patch(
            `api/stocks/${this.selectedStockForCheck.id}/withdraw`, {}
          ).toPromise();
        } catch (e) {
          console.error('Erreur lors du retrait du stock HS :', e);
        }
        // Mise à jour locale : hors casier + indisponible
        const inList = this.allStocks.find(s => s.id === this.selectedStockForCheck!.id);
        if (inList) inList.lockerNumber = 0;
        this.selectedStockForCheck.lockerNumber = 0;

        this.buildLockersMapAndStats();

        // Affiche le dialog de destruction AVANT de relancer le scan
        this.hsWarningStock        = this.selectedStockForCheck;
        this.selectedStockForCheck = null;
        this.checkComment          = '';
        this.hsWarningDialogVisible = true;
        // Ne relance PAS le polling ici — il sera relancé à la fermeture du dialog HS
        return;
      }
// ─────────────────────────────────────────────────────────────────────────────

      this.selectedStockForCheck = null; this.checkComment = '';


      // Fin automatique si tous les stocks ont été scannés (réglementaire ou tout contrôler)
      if ((this.globalControlMode || this.isTotalControlMode) && this.expectedAlitracers.length === 0) {
        this.messageService.add({ severity: 'success',
          summary: this.globalControlMode ? 'Contrôle réglementaire terminé' : 'Tout contrôlé',
          detail: this.globalControlMode
            ? 'Tous les stocks ont été contrôlés réglementairement ce mois-ci. ✅'
            : 'Tous les stocks ont été contrôlés. ✅'
        });
        setTimeout(() => this.stopScanControl(), 1500);
        return;
      }

      this.messageService.add({ severity: 'info', summary: 'Contrôle enregistré',
        detail: 'Vous pouvez scanner le prochain stock.' });
      setTimeout(() => this.startPolling(), 500);

    } catch { this.showErrorToast("Erreur lors de l'enregistrement du contrôle"); }
  }

  // ── Statut & helpers ──────────────────────────────────────────────────────

  getStatusLabelFromStock(stock: Stock): string {
    if (stock.status === 1) return 'OK'; if (stock.status === 0) return 'NOK';
    if (stock.status === 2) return 'HS'; return 'Inconnu';
  }

  getStatusClassFromStock(stock: Stock): string {
    switch (stock.status) {
      case 1: return 'text-green-500 font-bold'; case 0: return 'text-orange-500 font-bold';
      case 2: return 'text-red-600 font-bold';   default: return 'text-gray-500';
    }
  }

  showAddToast(checkType: 'REGULATORY' | 'INDIVIDUAL' = 'INDIVIDUAL'): void {
    this.messageService.add({ severity: 'success', summary: 'Contrôle enregistré',
      detail: checkType === 'REGULATORY'
        ? 'Contrôle réglementaire enregistré — ratio et Excel mis à jour.'
        : 'Contrôle individuel enregistré — ratio et Excel non modifiés.'
    });
  }

  showErrorToast(detail = 'Erreur inconnue'): void {
    this.messageService.add({ severity: 'error', summary: 'Erreur', detail });
  }

  /** Appelée à la fermeture du dialog HS */
  closeHsWarning(): void {
    this.hsWarningDialogVisible = false;
    this.hsWarningStock         = null;

    // Retire l'alitracer du stock HS de la liste attendue (si mode scan actif)
    if (this.scanDialogVisible) {
      setTimeout(() => this.startPolling(), 500);
    }

    // Si plus aucun stock à scanner en mode global/total → fermeture automatique
    if ((this.globalControlMode || this.isTotalControlMode) && this.expectedAlitracers.length === 0) {
      this.messageService.add({
        severity: 'success',
        summary: this.globalControlMode ? 'Contrôle réglementaire terminé' : 'Tout contrôlé',
        detail: 'Tous les stocks ont été contrôlés. ✅'
      });
      setTimeout(() => this.stopScanControl(), 1500);
    }
  }


  private addRecentAction(action: string, locker: number): void {
    this.recentActions.unshift({ action, locker, time: new Date() });
    if (this.recentActions.length > 5) this.recentActions = this.recentActions.slice(0, 5);
    if (this.actionTimeout) clearTimeout(this.actionTimeout);
    this.actionTimeout = setTimeout(() => { this.recentActions = []; }, 30000);
  }
}
