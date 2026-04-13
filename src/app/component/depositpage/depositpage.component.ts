import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf, NgIf, NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBarcode, faStop, faBoxOpen, faDoorClosed } from '@fortawesome/free-solid-svg-icons';

import { ScanService } from '../../services/scan.service';
import { AuthAppService } from '../../services/auth-app.service';
import { CheckService } from '../../services/check.service';
import { PdfService } from '../../services/pdf.service';
import { StockService } from '../../services/stock.service';

interface Stock {
  id: number;
  alitracer: string;
  lockerNumber: number;
  available: boolean;
  status: number;
  product: { title: string; size: string; cmu: string; type?: string; brand?: string; picture?: string; };
  _checked?: boolean;
}

interface LockerGroup { locker: number; tools: Stock[]; }

interface CheckPdfData {
  checkDate: string; productName: string; alitracer: string; reference: string;
  lockerNumber: number; status: number; comment: string; controlledBy: string;
  brand: string; cmu: string; size: string;
}

@Component({
  selector: 'app-depositpage',
  standalone: true,
  templateUrl: './depositpage.component.html',
  styleUrls: ['./depositpage.component.css'],
  imports: [NgForOf, NgIf, NgClass, FormsModule, ToastModule, DialogModule, FaIconComponent],
  providers: [MessageService]
})
export class DepositpageComponent implements OnInit, OnDestroy {

  scanDialogVisible = false;
  scannedTools: Stock[] = [];

  private pollingInterval: any;
  protected isProcessing = false;

  lockerDialogVisible = false;
  currentLocker: number | null = null;
  currentLockerTools: Stock[] = [];
  private lockerQueue: LockerGroup[] = [];
  private currentLockerIndex = 0;

  checkDialogVisible = false;
  selectedStockForCheck: Stock | null = null;
  checkComment = '';

  manualSuffix    = '';
  manualScanError = '';

  faBarcode    = faBarcode;
  faStop       = faStop;
  faBoxOpen    = faBoxOpen;
  faDoorClosed = faDoorClosed;

  allStocks: Stock[] = [];

  constructor(
    private scanService: ScanService,
    private authService: AuthAppService,
    private checkService: CheckService,
    private pdfService: PdfService,
    private httpClient: HttpClient,
    private messageService: MessageService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> { await this.loadStocks(); }
  ngOnDestroy(): void { this.stopPolling(); }

  isLoggedIn(): boolean { return this.authService.isLoggedIn(); }

  // ── Chargement ────────────────────────────────────────────────────────────

  private async loadStocks(): Promise<void> {
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();
    this.allStocks = [...this.scanService.getAvailableStocks(), ...this.scanService.getLoanedStocks()];
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  startDepositScan(): void {
    this.scannedTools = [];
    this.scanDialogVisible = true;
    setTimeout(() => this.startPolling(), 0);
  }

  stopDepositScan(): void {
    this.stopPolling();
    this.scanDialogVisible = false;
    if (this.scannedTools.length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'Aucun outil scanné',
        detail: "Vous n'avez scanné aucun outil à déposer." });
      return;
    }
    this.startCheckFlow();
  }

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
    }, 1250);
  }

  private stopPolling(): void {
    if (this.pollingInterval) { clearInterval(this.pollingInterval); this.pollingInterval = null; }
    this.isProcessing = false;
  }

  submitManualScan(): void {
    const suffix = this.manualSuffix.trim();
    if (!/^\d{4}$/.test(suffix)) {
      this.manualScanError = 'Saisissez exactement 4 chiffres.';
      return;
    }
    this.manualScanError = '';
    const alitracer = 'L000000' + suffix;
    this.manualSuffix = '';
    this.isProcessing = true;
    this.handleScannedCode(alitracer);
  }

  private async handleScannedCode(decodedText: string): Promise<void> {
    try {
      const alitracer = decodedText.trim();

      const alreadyScanned = this.scannedTools.some(t => StockService.matchesAlitracer(t, alitracer));
      if (alreadyScanned) {
        this.messageService.add({ severity: 'warn', summary: 'Déjà scanné',
          detail: `L'outil ${alitracer} a déjà été scanné.` });
        return;
      }

      const stock = StockService.findByAlitracer(this.allStocks, alitracer);
      if (!stock) {
        this.messageService.add({ severity: 'error', summary: 'Outil inconnu',
          detail: `L'alitracer ${alitracer} ne correspond à aucun outil.` });
        return;
      }
      if (stock.available) {
        this.messageService.add({ severity: 'warn', summary: 'Outil déjà disponible',
          detail: `L'outil ${alitracer} est déjà dans son casier.` });
        return;
      }
      if (stock.status === 2) {
        this.messageService.add({ severity: 'error', summary: 'Outil HS',
          detail: `L'outil ${alitracer} est HS et ne peut pas être déposé.` });
        return;
      }

      this.scannedTools.push(stock);
      this.messageService.add({ severity: 'success', summary: 'Outil ajouté',
        detail: `${alitracer} ajouté${stock.lockerNumber ? ' (Casier ' + stock.lockerNumber + ')' : ' (hors casier)'}` });

    } catch {
      this.messageService.add({ severity: 'error', summary: 'Erreur',
        detail: 'Une erreur est survenue lors du traitement du scan.' });
    } finally {
      await this.scanService.clearScan();
      await new Promise(resolve => setTimeout(resolve, 200));
      this.isProcessing = false;
    }
  }

  // ── Flux de contrôle ──────────────────────────────────────────────────────

  private startCheckFlow(): void {
    if (this.scannedTools.length === 0) return;
    this.openNextToolForCheck();
  }

  private openNextToolForCheck(): void {
    const next = this.scannedTools.find(t => !t._checked);
    if (!next) {
      this.groupToolsByLocker();
      this.currentLockerIndex = 0;
      this.processNextLocker();
      return;
    }
    this.selectedStockForCheck = next;
    this.checkComment          = '';
    this.checkDialogVisible    = true;
  }

  async confirmCheck(status: number): Promise<void> {
    if (!this.selectedStockForCheck) return;
    const appUser = this.authService.getCurrentUser();
    if (!appUser) {
      this.messageService.add({ severity: 'error', summary: 'Erreur', detail: 'Vous devez être connecté.' });
      return;
    }

    const checkDate = new Date().toISOString();
    const payload: any = {
      id: null, date: checkDate, status, comment: this.checkComment || '',
      checkType: 'INDIVIDUAL',
      user: { id: appUser.id }, stock: { id: this.selectedStockForCheck.id }
    };

    try {
      const savedCheck: any = await this.checkService.createCheck(payload);

      const pdfData: CheckPdfData = {
        checkDate,
        productName:  this.selectedStockForCheck.product?.title   || 'Produit inconnu',
        alitracer:    this.selectedStockForCheck.alitracer          || '',
        reference:    (this.selectedStockForCheck as any).reference || '',
        lockerNumber: this.selectedStockForCheck.lockerNumber,
        status, comment: this.checkComment || '',
        controlledBy: appUser.username,
        brand: this.selectedStockForCheck.product?.brand || 'N/A',
        cmu:   this.selectedStockForCheck.product?.cmu   || 'N/A',
        size:  this.selectedStockForCheck.product?.size  || 'N/A'
      };

      const pdfResult: any = await this.pdfService.generateAndSavePdf(pdfData);
      if (pdfResult?.filename) {
        await this.httpClient.patch(`api/checks/${savedCheck.id}/pdf`, {},
          { params: { filename: pdfResult.filename } }).toPromise();
      }

      this.selectedStockForCheck.status = status;
      const inList = this.allStocks.find(s => s.id === this.selectedStockForCheck!.id);
      if (inList) inList.status = status;

      this.messageService.add({ severity: 'success', summary: 'Contrôle enregistré',
        detail: `Statut ${this.getStatusLabelFromStock(this.selectedStockForCheck)} enregistré pour ${this.selectedStockForCheck.alitracer}.` });

    } catch {
      this.messageService.add({ severity: 'error', summary: 'Erreur',
        detail: "Erreur lors de l'enregistrement du contrôle." });
    }

    this.checkDialogVisible = false;
    (this.selectedStockForCheck as any)._checked = true;
    this.selectedStockForCheck = null;
    this.checkComment          = '';
    this.openNextToolForCheck();
  }

  // ── Groupement & ouverture des casiers ────────────────────────────────────

  private groupToolsByLocker(): void {
    const grouped = new Map<number, Stock[]>();
    for (const tool of this.scannedTools) {
      const key = tool.lockerNumber ?? 0;   // null → 0
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(tool);
    }
    this.lockerQueue = Array.from(grouped.entries())
      .map(([locker, tools]) => ({ locker, tools }))
      // Casiers normaux d'abord, hors-casier (0) en dernier
      .sort((a, b) => {
        if (a.locker === 0) return 1;
        if (b.locker === 0) return -1;
        return a.locker - b.locker;
      });
  }

  private async processNextLocker(): Promise<void> {
    if (this.currentLockerIndex >= this.lockerQueue.length) {
      this.messageService.add({ severity: 'success', summary: 'Dépôt terminé',
        detail: 'Tous les outils ont été contrôlés et déposés.' });
      setTimeout(() => this.router.navigate(['/scanpage']), 2000);
      return;
    }

    const currentGroup    = this.lockerQueue[this.currentLockerIndex];
    this.currentLocker      = currentGroup.locker;
    this.currentLockerTools = currentGroup.tools;

    // ── Stocks hors casier (mur) : pas d'ouverture, pas de dialog ──────────
    if (!this.currentLocker || this.currentLocker === 0) {
      this.messageService.add({ severity: 'info', summary: 'Dépôt hors casier',
        detail: `${this.currentLockerTools.length} outil(s) rangé(s) sur le mur — aucun casier à ouvrir.` });
      await this.updateStocksAndHistory();
      this.currentLockerIndex++;
      await this.processNextLocker();
      return;
    }

    // ── Stocks avec casier : ouverture normale ──────────────────────────────
    try {
      await this.scanService.openLocker(this.currentLocker);
      this.messageService.add({ severity: 'success', summary: 'Casier ouvert',
        detail: `Casier ${this.currentLocker} ouvert. Rangez les outils.` });
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Erreur',
        detail: `Impossible d'ouvrir le casier ${this.currentLocker}.` });
      this.currentLockerIndex++;
      await this.processNextLocker();
      return;
    }
    this.lockerDialogVisible = true;
  }

  async closeCurrentLocker(): Promise<void> {
    if (!this.currentLocker) return;
    try {
      this.lockerDialogVisible = false;
      await this.scanService.closeLocker(this.currentLocker);
      this.messageService.add({ severity: 'success', summary: 'Casier fermé',
        detail: `Casier ${this.currentLocker} fermé avec succès.` });
      await this.updateStocksAndHistory();
      this.currentLockerIndex++;
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.processNextLocker();
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Erreur',
        detail: `Impossible de fermer le casier ${this.currentLocker}.` });
    }
  }

  private async updateStocksAndHistory(): Promise<void> {
    const appUser = this.authService.getCurrentUser();
    if (!appUser) return;
    for (const tool of this.currentLockerTools) {
      try {
        await this.scanService.createHistory({
          stock: { id: tool.id }, user: { id: appUser.id },
          date: new Date().toISOString(), type: 'deposit'
        });
      } catch {
        this.messageService.add({ severity: 'error', summary: 'Erreur dépôt',
          detail: `Impossible d'enregistrer le dépôt de ${tool.alitracer}.` });
      }
    }
    await this.scanService.refreshData();
    await this.loadStocks();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  getStatusLabelFromStock(stock: Stock): string {
    if (stock.status === 1) return 'OK';
    if (stock.status === 0) return 'NOK';
    if (stock.status === 2) return 'HS';
    return 'Inconnu';
  }

  getStatusClassFromStock(stock: Stock): string {
    if (stock.status === 1) return 'text-blue-700 font-bold';
    if (stock.status === 0) return 'text-orange-700 font-bold';
    if (stock.status === 2) return 'text-red-700 font-bold';
    return 'text-gray-600';
  }

  getAlitracerList(stock: Stock): string[] {
    return StockService.getAlitracerList(stock);
  }
}
