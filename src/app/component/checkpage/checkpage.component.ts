import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { faListCheck, faFileExcel, faDoorOpen, faBarcode, faStop } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Html5Qrcode } from 'html5-qrcode';

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
  lockerNumber: number;
  status: number | null;
  lastCheckDate: string | null;
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

@Component({
  selector: 'app-checkpage',
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    NgClass,
    DatePipe,
    ReactiveFormsModule,
    FormsModule,
    ToastModule,
    DialogModule,
    FaIconComponent
  ],
  templateUrl: './checkpage.component.html',
  styleUrls: ['./checkpage.component.css'],
  providers: [MessageService]
})
export class CheckpageComponent implements OnInit, OnDestroy {

  // Tous les stocks
  allStocks: Stock[] = [];

  // Map pour affichage grille
  lockersMap: { [lockerNumber: number]: LockerInfo | undefined } = {};

  // Stats
  stats: LockerStats = {
    withStock: 0,
    empty: 0,
    total: 24
  };

  // Casier actif et ses stocks
  activeLocker: number | null = null;
  lockerStocks: Stock[] = [];
  lockerDetailsDialogVisible = false;

  recentActions: { action: string; locker: number; time: Date }[] = [];
  private actionTimeout: any;

  // Stock sélectionné pour contrôle individuel (popup)
  selectedStockForCheck: Stock | null = null;

  // Commentaire saisi dans le popup individuel
  checkComment = '';

  // Visibilité du dialog de contrôle individuel
  checkDialogVisible = false;

  // Confirmation fermeture casier
  lockerCloseDialogVisible = false;
  private pendingStatus: number | null = null;

  // Excel mensuels
  monthlyExcelFiles: any[] = [];

  // MODE SCAN (caméra)
  scanModeActive = false;
  scanDialogVisible = false;
  scanLocked = false;
  private html5QrCodeProduct?: Html5Qrcode;
  private productScannerInitialized = false;

  // Mode "Tout Contrôler" (scan global sans casier spécifique)
  globalControlMode = false;

  protected readonly faListCheck = faListCheck;
  protected readonly faFileExcel = faFileExcel;
  protected readonly faDoorOpen = faDoorOpen;
  protected readonly faBarcode = faBarcode;
  protected readonly faStop = faStop;

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
    // Initialisation défensive : créer lockersMap avec valeurs par défaut
    for (let num = 1; num <= 24; num++) {
      this.lockersMap[num] = { hasStock: false };
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadLockers();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
    await this.loadMonthlyExcelFiles();
  }

  ngOnDestroy(): void {
    this.stopProductScanner();
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

  /**
   * Chargement des stocks
   */
  private async loadLockers(): Promise<void> {
    await this.checkService.refreshStocks();
    const rawStocks: any[] = this.checkService.getStocks();

    this.allStocks = rawStocks.map(s => ({
      id: s.id,
      alitracer: s.alitracer,
      lockerNumber: s.lockerNumber,
      reference: s.reference,
      status: s.status,
      lastCheckDate: null,
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

  /**
   * Charge la date du dernier contrôle pour chaque stock
   */
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

  /**
   * Charge la liste des fichiers Excel mensuels disponibles
   */
  private async loadMonthlyExcelFiles(): Promise<void> {
    try {
      this.monthlyExcelFiles = await this.excelService.getMonthlyFiles();
    } catch (error) {
      console.error('Erreur chargement fichiers Excel:', error);
    }
  }

  private buildLockersMapAndStats(): void {
    const map: { [lockerNumber: number]: LockerInfo } = {};
    let withStock = 0;
    let empty = 0;

    for (let num = 1; num <= 24; num++) {
      const stocks = this.getStocksByLocker(num);
      const hasStock = stocks.length > 0;
      map[num] = { hasStock };

      if (hasStock) {
        withStock++;
      } else {
        empty++;
      }
    }

    this.lockersMap = map;
    this.stats = {
      withStock,
      empty,
      total: 24
    };
  }

  async refreshLockers(): Promise<void> {
    await this.loadLockers();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
    await this.loadMonthlyExcelFiles();
  }

  getStocksByLocker(lockerNumber: number): Stock[] {
    return this.allStocks.filter(s => s.lockerNumber === lockerNumber);
  }

  openLockerDetails(lockerNumber: number): void {
    this.activeLocker = lockerNumber;
    this.lockerStocks = this.getStocksByLocker(lockerNumber);
    this.lockerDetailsDialogVisible = true;
  }

  /**
   * Télécharge le fichier Excel du mois en cours
   */
  async downloadCurrentMonthExcel(): Promise<void> {
    const now = new Date();
    const monthName = this.getMonthName(now.getMonth());
    const year = now.getFullYear();
    const filename = `Controle_${monthName}_${year}.xlsx`;

    await this.downloadMonthlyExcel(filename);
  }

  /**
   * Télécharge un fichier Excel mensuel spécifique
   */
  async downloadMonthlyExcel(filename: string): Promise<void> {
    try {
      const blob = await this.excelService.downloadMonthlyExcel(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);

      this.messageService.add({
        severity: 'success',
        summary: 'Téléchargement réussi',
        detail: `Le fichier ${filename} a été téléchargé.`
      });
    } catch (error) {
      console.error('Erreur téléchargement Excel:', error);
      this.showErrorToast('Erreur lors du téléchargement du fichier Excel');
    }
  }

  /**
   * Retourne le nom du mois en français
   */
  private getMonthName(month: number): string {
    const months = [
      'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
    ];
    return months[month];
  }

  /**
   * Met à jour le fichier Excel mensuel après un contrôle
   */
  private async updateMonthlyExcel(stock: Stock, status: number, comment: string, username: string): Promise<void> {
    const checkDate = new Date();
    const payload = {
      alitracer: stock.alitracer,
      size: stock.product.size,
      cmu: stock.product.cmu,
      lockerNumber: stock.lockerNumber,
      status: status,
      comment: comment,
      controlledBy: username,
      date: checkDate.toISOString()
    };

    try {
      await this.excelService.updateMonthlyExcel(payload);
    } catch (error) {
      console.error('Erreur mise à jour Excel:', error);
    }
  }

  /**
   * ==============================
   * CONTRÔLE PAR SCAN CAMÉRA (UN CASIER)
   * ==============================
   */

  /**
   * Démarre le mode de contrôle par scan caméra pour UN casier
   * Ouvre le casier et lance la caméra
   */
  async startScanControl(): Promise<void> {
    if (!this.activeLocker) {
      this.showErrorToast('Aucun casier sélectionné');
      return;
    }

    if (this.lockerStocks.length === 0) {
      this.showErrorToast('Aucun stock à contrôler dans ce casier');
      return;
    }

    // Ouvre le casier physiquement
    try {
      await this.scanService.openLocker(this.activeLocker);
      this.messageService.add({
        severity: 'info',
        summary: 'Casier ouvert',
        detail: `Casier ${this.activeLocker} ouvert. Scannez les alitracers avec la caméra.`
      });

      // Active le mode scan
      this.scanModeActive = true;
      this.globalControlMode = false;
      this.lockerDetailsDialogVisible = false;
      this.scanDialogVisible = true;

      // Lance la caméra après l'ouverture du dialog
      setTimeout(() => this.startScanWorkflow(), 300);

    } catch (e) {
      console.error('Erreur ouverture casier:', e);
      this.showErrorToast(`Impossible d'ouvrir le casier ${this.activeLocker}`);
    }
  }

  /**
   * Arrête le mode de contrôle et demande confirmation fermeture casier
   */
  async stopScanControl(): Promise<void> {
    this.scanModeActive = false;
    this.scanDialogVisible = false;
    await this.stopProductScanner();

    // Affiche le dialog de confirmation fermeture casier
    this.lockerCloseDialogVisible = true;
  }

  /**
   * Confirmation fermeture casier (après arrêt du scan)
   */
  async confirmLockerClosed(): Promise<void> {
    this.lockerCloseDialogVisible = false;

    // On garde la valeur locale pour le log / message
    const lockerToClose = this.activeLocker;

    if (lockerToClose != null) {
      try {
        await this.scanService.closeLocker(lockerToClose);
        this.messageService.add({
          severity: 'info',
          summary: 'Casier fermé',
          detail: `Casier ${lockerToClose} fermé.`
        });
      } catch (error) {
        console.error('Erreur fermeture casier:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur casier',
          detail: `Impossible de fermer le casier ${lockerToClose}.`
        });
        // Tu peux choisir de return ici si tu ne veux pas reset le contexte en cas d’erreur
        // return;
      }
    }

    // Réinitialise le contexte
    this.activeLocker = null;
    this.selectedStockForCheck = null;
    this.globalControlMode = false;

    this.messageService.add({
      severity: 'info',
      summary: 'Contrôle terminé',
      detail: 'Le mode de contrôle a été arrêté.'
    });

    await this.refreshLockers();
  }


  /**
   * ==============================
   * TOUT CONTRÔLER (MODE GLOBAL)
   * ==============================
   */

  /**
   * Ouvre tous les casiers et lance le mode scan global
   */
  async startGlobalControl(): Promise<void> {
    try {
      // Ouvre tous les casiers
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
        summary: 'Tous les casiers ouverts',
        detail: 'Tous les casiers ont été ouverts. Scannez n\'importe quel alitracer.'
      });

      // Active le mode scan global
      this.scanModeActive = true;
      this.globalControlMode = true;
      this.activeLocker = null;
      this.lockerStocks = this.allStocks; // Tous les stocks disponibles
      this.scanDialogVisible = true;

      // Lance la caméra
      setTimeout(() => this.startScanWorkflow(), 300);

    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur globale',
        detail: 'Erreur lors de l\'ouverture des casiers'
      });
    }
  }

  /**
   * Initialise Html5Qrcode sur l'élément #qr-reader
   */
  private async startScanWorkflow(): Promise<void> {
    await this.stopProductScanner();

    const elementId = 'qr-reader';
    this.html5QrCodeProduct = new Html5Qrcode(elementId);

    try {
      await this.html5QrCodeProduct.start(
        { facingMode: 'environment' }, // Caméra arrière
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          await this.handleScannedCode(decodedText);
        },
        () => {} // Ignore les erreurs de frame
      );
      this.productScannerInitialized = true;
    } catch (err) {
      console.error('Erreur démarrage scanner contrôle:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur caméra',
        detail: 'Impossible de démarrer la caméra. Vérifiez les permissions.'
      });
      this.scanDialogVisible = false;
    }
  }

  /**
   * Gestion d'un code scanné par la caméra
   */
  private async handleScannedCode(decodedText: string): Promise<void> {
    if (!this.scanModeActive || this.scanLocked) {
      return;
    }

    // Lock pour éviter les scans multiples
    this.scanLocked = true;
    setTimeout(() => {
      this.scanLocked = false;
    }, 1500);

    const alitracer = decodedText.trim();

    // Mode global : cherche dans TOUS les stocks
    if (this.globalControlMode) {
      const stock = this.allStocks.find(s => s.alitracer === alitracer);

      if (!stock) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Stock non trouvé',
          detail: `L'alitracer "${alitracer}" ne correspond à aucun stock.`
        });
        return;
      }

      // Ouvre le dialog de contrôle pour ce stock
      this.selectedStockForCheck = stock;
      this.checkComment = '';
      this.checkDialogVisible = true;
      return;
    }

    // Mode casier spécifique : cherche uniquement dans le casier actif
    if (!this.activeLocker) {
      this.showErrorToast('Aucun casier actif pour ce contrôle');
      return;
    }

    const stock = this.lockerStocks.find(s => s.alitracer === alitracer);

    if (!stock) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Stock non trouvé',
        detail: `L'alitracer "${alitracer}" ne correspond à aucun stock du casier ${this.activeLocker}.`
      });
      return;
    }

    // Ouvre le dialog de contrôle pour ce stock
    this.selectedStockForCheck = stock;
    this.checkComment = '';
    this.checkDialogVisible = true;
  }

  /**
   * Arrête le scanner caméra
   */
  private async stopProductScanner(): Promise<void> {
    if (this.html5QrCodeProduct && this.productScannerInitialized) {
      try {
        await this.html5QrCodeProduct.stop();
        await this.html5QrCodeProduct.clear();
      } catch (err) {
        console.error("Erreur à l'arrêt du scanner contrôle", err);
      }
    }
    this.html5QrCodeProduct = undefined;
    this.productScannerInitialized = false;
  }

  /**
   * Vérifie si au moins un stock du casier n'a pas été contrôlé ce mois-ci
   */
  needsCheck(lockerNumber: number): boolean {
    const stocks = this.getStocksByLocker(lockerNumber);

    if (stocks.length === 0) {
      return false;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return stocks.some(stock => {
      if (!stock.lastCheckDate) {
        return true;
      }

      const parts = stock.lastCheckDate.split(/[\s/:]/);
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const lastCheckDate = new Date(year, month, day);

      return lastCheckDate < startOfMonth;
    });
  }

  /**
   * Vérifie si un stock spécifique a été contrôlé ce mois-ci
   */
  isStockCheckedThisMonth(stock: Stock): boolean {
    if (!stock.lastCheckDate) {
      return false;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const parts = stock.lastCheckDate.split(/[\s/:]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const lastCheckDate = new Date(year, month, day);

    return lastCheckDate >= startOfMonth;
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

  /**
   * Libellé texte du statut
   */
  getStatusLabelFromStock(stock: Stock): string {
    if (stock.status === 1) {
      return 'OK';
    }
    if (stock.status === 0) {
      return 'NOK';
    }
    if (stock.status === 2) {
      return 'HS';
    }
    return 'Inconnu';
  }

  /**
   * Classe CSS du statut (couleur)
   */
  getStatusClassFromStock(stock: Stock): string {
    switch (stock.status) {
      case 1:
        return 'text-green-500 font-bold';
      case 0:
        return 'text-orange-500 font-bold';
      case 2:
        return 'text-red-600 font-bold';
      default:
        return 'text-gray-500';
    }
  }

  /**
   * Clic sur OK/NOK/HS pour contrôle
   */
  confirmCheck(status: number): void {
    this.checkDialogVisible = false;
    // Exécute immédiatement le contrôle (sans dialog de confirmation)
    this.executeCheck(status);
  }

  /**
   * Exécution du contrôle après confirmation fermeture
   */
  private async executeCheck(status: number): Promise<void> {
    if (!this.selectedStockForCheck) {
      this.showErrorToast('Aucun produit sélectionné pour le contrôle');
      return;
    }

    const appUser = this.authApp.getCurrentUser();
    if (!appUser) {
      this.showErrorToast('Vous devez être connecté pour réaliser un contrôle');
      return;
    }

    const checkDate = new Date().toISOString();
    const payload: any = {
      id: null,
      date: checkDate,
      status,
      comment: this.checkComment || '',
      user: { id: appUser.id },
      stock: { id: this.selectedStockForCheck.id }
    };

    try {
      // 1. Crée le check
      const savedCheck: any = await this.checkService.createCheck(payload);

      // 2. Prépare les données PDF
      const pdfData: CheckPdfData = {
        checkDate: checkDate,
        productName: this.selectedStockForCheck.product?.title || 'Produit inconnu',
        alitracer: this.selectedStockForCheck.alitracer || '',
        reference: this.selectedStockForCheck.reference || '',
        lockerNumber: this.selectedStockForCheck.lockerNumber,
        status: status,
        comment: this.checkComment || '',
        controlledBy: appUser.username,
        brand: this.selectedStockForCheck.product?.brand || 'N/A',
        cmu: this.selectedStockForCheck.product?.cmu || 'N/A',
        size: this.selectedStockForCheck.product?.size || 'N/A'
      };

      // 3. Génère ET sauvegarde le PDF
      const pdfResult: any = await this.pdfService.generateAndSavePdf(pdfData);

      // 4. Met à jour le check avec le filename
      if (pdfResult && pdfResult.filename) {
        await this.httpClient.patch(
          `api/checks/${savedCheck.id}/pdf`,
          {},
          { params: { filename: pdfResult.filename } }
        ).toPromise();
      }

      // 5. Met à jour le fichier Excel mensuel
      await this.updateMonthlyExcel(
        this.selectedStockForCheck,
        status,
        this.checkComment,
        appUser.username
      );

      this.showAddToast();

      // Met à jour le statut local
      this.selectedStockForCheck.status = status;
      const stockInList = this.allStocks.find(s => s.id === this.selectedStockForCheck!.id);
      if (stockInList) {
        stockInList.status = status;
      }

      await this.checkService.refreshData();
      await this.loadLockers();
      await this.loadLastCheckDates();
      this.buildLockersMapAndStats();
      await this.loadMonthlyExcelFiles();

      this.selectedStockForCheck = null;
      this.checkComment = '';

      // Retourne directement au scan (pas de dialog de confirmation)
      if (this.scanModeActive) {
        this.messageService.add({
          severity: 'info',
          summary: 'Contrôle enregistré',
          detail: 'Vous pouvez scanner le prochain stock.'
        });
      }

    } catch (error) {
      console.error('Error adding check:', error);
      this.showErrorToast('Erreur lors de l\'enregistrement du contrôle');
    }
  }

  /**
   * Toast success
   */
  showAddToast(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Contrôle enregistré',
      detail: 'Vous avez réalisé un contrôle sur un produit'
    });
  }

  /**
   * Toast erreur
   */
  showErrorToast(detail: string = 'Erreur inconnue'): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Erreur',
      detail
    });
  }

  /**
   * Nom du user connecté
   */
  get currentUserName(): string {
    const user = this.authApp.getCurrentUser();
    return user ? user.username : 'Utilisateur';
  }
}
