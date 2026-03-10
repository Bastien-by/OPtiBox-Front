import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf, NgIf, NgClass, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { faListCheck, faFileExcel, faDoorOpen, faBarcode, faStop } from '@fortawesome/free-solid-svg-icons';
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

  // Excel mensuels
  monthlyExcelFiles: any[] = [];

  // MODE SCAN DOUCHETTE
  scanDialogVisible = false;

  // Mode "Tout Contrôler" (scan global sans casier spécifique)
  globalControlMode = false;

  /** Liste des alitracer attendus (si mode casier spécifique) */
  expectedAlitracers: string[] = [];

  /* Polling douchette */
  private pollingInterval: any;
  private isProcessing = false;

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
    this.stopPolling();
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
   * Retourne le nombre total de stocks disponibles
   */
  get totalAvailableStocks(): number {
    return this.allStocks.length;
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

  /* -------- CONTRÔLE GLOBAL -------- */

  /**
   * ✅ Démarre le contrôle global : envoie UNIQUEMENT la commande Manage_All = true
   * L'automate gère l'ouverture des 24 casiers
   */
  async startGlobalControl(): Promise<void> {
    try {
      this.messageService.add({
        severity: 'info',
        summary: 'Ouverture en cours',
        detail: 'Commande d\'ouverture envoyée à l\'automate...'
      });

      // ✅ UNE SEULE requête : écrit Manage_All = true
      const result = await this.scanService.openAllLockers();

      // ✅ CORRIGÉ : Utilise successCount au lieu de message
      console.log(`📊 Commande ouverture envoyée avec succès`);

      this.messageService.add({
        severity: 'success',
        summary: 'Commande envoyée',
        detail: 'L\'automate ouvre tous les casiers. Démarrage du scan...'
      });

      // Active le mode scan global
      this.globalControlMode = true;
      this.activeLocker = null;
      this.expectedAlitracers = [];
      this.scanDialogVisible = true;

      console.log('⏱️ Démarrage du polling immédiat');
      this.startPolling();

    } catch (error) {
      console.error('❌ Erreur commande ouverture:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Erreur lors de l\'envoi de la commande d\'ouverture'
      });
    }
  }

  /**
   * ✅ Confirmation fermeture : envoie UNIQUEMENT la commande Manage_All = false
   * L'automate gère la fermeture des 24 casiers
   */
  async confirmLockerClosed(): Promise<void> {
    this.lockerCloseDialogVisible = false;

    if (this.globalControlMode) {
      // ✅ Mode global : ferme TOUS les casiers via Manage_All = false
      try {
        this.messageService.add({
          severity: 'info',
          summary: 'Fermeture en cours',
          detail: 'Commande de fermeture envoyée à l\'automate...'
        });

        // ✅ UNE SEULE requête : écrit Manage_All = false
        const result = await this.scanService.closeAllLockers();

        // ✅ CORRIGÉ : Utilise successCount au lieu de message
        console.log(`📊 Commande fermeture envoyée avec succès`);

        this.messageService.add({
          severity: 'success',
          summary: 'Commande envoyée',
          detail: 'L\'automate ferme tous les casiers.'
        });

      } catch (error) {
        console.error('❌ Erreur commande fermeture:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Erreur lors de l\'envoi de la commande de fermeture'
        });
      }

      this.globalControlMode = false;

    } else if (this.activeLocker) {
      // ✅ Mode casier spécifique : ferme UN SEUL casier
      try {
        await this.scanService.closeLocker(this.activeLocker);
        this.messageService.add({
          severity: 'success',
          summary: 'Casier fermé',
          detail: `Casier ${this.activeLocker} fermé.`
        });
      } catch (error) {
        console.error('Erreur fermeture casier:', error);
        this.showErrorToast(`Impossible de fermer le casier ${this.activeLocker}`);
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



  /* -------- CONTRÔLE CASIER SPÉCIFIQUE -------- */

  /**
   * ✅ Démarre le mode de contrôle par scan douchette pour UN casier
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
        detail: `Casier ${this.activeLocker} ouvert. Vous pouvez scanner.`
      });

      // Active le mode scan
      this.globalControlMode = false;
      this.expectedAlitracers = this.lockerStocks.map(s => s.alitracer);
      this.lockerDetailsDialogVisible = false;
      this.scanDialogVisible = true;

      // ✅ DÉMARRE le polling immédiatement
      this.startPolling();

    } catch (e) {
      console.error('Erreur ouverture casier:', e);
      this.showErrorToast(`Impossible d'ouvrir le casier ${this.activeLocker}`);
    }
  }

  /**
   * ✅ Arrête le mode de contrôle
   */
  async stopScanControl(): Promise<void> {
    this.stopPolling();

    this.scanDialogVisible = false;

    // ✅ Affiche le dialog de confirmation fermeture immédiatement
    this.lockerCloseDialogVisible = true;
  }




  /* -------- POLLING DOUCHETTE -------- */

  /**
   * ✅ Démarre le polling (2000) avec check isProcessing AVANT readScan
   */
  private startPolling(): void {
    console.log('⚡ POLLING DOUCHETTE START');

    // Clear initial
    this.scanService.clearScan();

    this.pollingInterval = setInterval(async () => {
      // ✅ STOP si déjà en cours de traitement
      if (this.isProcessing) {
        console.log('⏸️ Traitement en cours, skip ce cycle');
        return;
      }

      try {
        const response = await this.scanService.readScan();

        if (response && response.success && response.value) {
          const val = response.value.trim();

          if (val !== '') {
            console.log(`✅ SCAN DÉTECTÉ: "${val}"`);

            // ✅ LOCK immédiatement
            this.isProcessing = true;

            // ✅ Traite le scan
            await this.handleScannedCode(val);
          }
        }
      } catch (err) {
        console.error('❌ Erreur poll:', err);
        this.isProcessing = false; // ✅ Débloque en cas d'erreur
      }
    }, 2000);
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
   * ✅ Traite le code scanné (SANS vérification mensuelle)
   */
  private async handleScannedCode(decodedText: string): Promise<void> {
    try {
      console.log('🔍 Traitement scan:', decodedText);

      const alitracer = decodedText.trim();

      // En mode casier spécifique, vérifie que l'alitracer appartient au casier
      if (!this.globalControlMode && this.expectedAlitracers.length > 0) {
        if (!this.expectedAlitracers.includes(alitracer)) {
          this.messageService.add({
            severity: 'error',
            summary: 'Alitracer non attendu',
            detail: `Ce code ne fait pas partie du casier ${this.activeLocker}.`
          });
          return;
        }
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

      // ✅ SUPPRIMÉ : Vérification mensuelle (on peut checker plusieurs fois)

      // Ouvre le dialog de contrôle (OK/NOK/HS)
      this.selectedStockForCheck = stock;
      this.checkComment = '';
      this.checkDialogVisible = true;

      // ⏸️ Pause le polling pendant le dialog
      this.stopPolling();

    } catch (error) {
      console.error('❌ Erreur traitement scan:', error);

      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Une erreur est survenue lors du traitement du scan.'
      });

    } finally {
      // ✅ CLEAR + UNLOCK dans TOUS les cas
      await this.scanService.clearScan();
      console.log('🧹 Buffer cleared');

      // ✅ Pause 1000ms pour être sûr que le buffer est vidé
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.isProcessing = false;
      console.log('🔓 isProcessing = false');
    }
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
   * Retourne true si le dernier contrôle du stock est dans le mois courant
   */
  isStockCheckedThisMonth(stock: Stock): boolean {
    if (!stock.lastCheckDate) {
      return false;
    }

    // stock.lastCheckDate est une string "dd/MM/yyyy HH:mm"
    const parts = stock.lastCheckDate.split(/[\\s/:]/); // [dd, MM, yyyy, HH, mm]
    if (parts.length < 3) {
      return false;
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // JS: 0 = Janvier
    const year = parseInt(parts[2], 10);

    const lastCheck = new Date(year, month, day);
    const now = new Date();

    return (
      lastCheck.getFullYear() === now.getFullYear() &&
      lastCheck.getMonth() === now.getMonth()
    );
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
    // Exécute immédiatement le contrôle
    this.executeCheck(status);
  }

  /**
   * Exécution du contrôle après validation
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

      // ✅ Relance le polling pour le prochain scan
      this.messageService.add({
        severity: 'info',
        summary: 'Contrôle enregistré',
        detail: 'Vous pouvez scanner le prochain stock.'
      });

      setTimeout(() => this.startPolling(), 500);

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
