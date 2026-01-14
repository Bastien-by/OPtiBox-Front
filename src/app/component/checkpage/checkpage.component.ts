import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf, NgClass, DatePipe  } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { faListCheck, faFileExcel, faDoorOpen} from '@fortawesome/free-solid-svg-icons';
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
export class CheckpageComponent implements OnInit {

  // Tous les stocks
  allStocks: Stock[] = [];

  // Map pour affichage grille (INITIALISÉ AVEC VALEURS PAR DÉFAUT)
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

  // Contrôle en masse
  bulkCheckDialogVisible = false;
  bulkCheckComment = '';

  // Confirmation fermeture casier
  lockerCloseDialogVisible = false;
  private checkFlow: 'individual' | 'bulk' | null = null;
  private pendingStatus: number | null = null;

  // Excel mensuels
  monthlyExcelFiles: any[] = [];

  protected readonly faListCheck = faListCheck;
  protected readonly faFileExcel = faFileExcel;
  protected readonly faDoorOpen = faDoorOpen;

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
   * Ouverture du dialog de contrôle individuel pour un stock donné
   * Ouvre d'abord le casier physiquement
   */
  async openCheckDialog(stock: Stock): Promise<void> {
    this.selectedStockForCheck = stock;
    this.checkComment = '';
    this.checkFlow = 'individual';

    // Ouvre le casier physiquement
    try {
      await this.scanService.openLocker(stock.lockerNumber);
      this.messageService.add({
        severity: 'info',
        summary: 'Casier ouvert',
        detail: `Casier ${stock.lockerNumber} ouvert pour contrôle.`
      });

      // Affiche directement le dialog de contrôle
      this.checkDialogVisible = true;

    } catch (e) {
      console.error('Erreur ouverture casier (contrôle) :', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur casier',
        detail: `Impossible d'ouvrir le casier ${stock.lockerNumber}.`
      });
    }
  }

  /**
   * Ouvre le dialog de contrôle en masse
   * Ouvre d'abord le casier physiquement
   */
  async openBulkCheckDialog(): Promise<void> {
    if (this.lockerStocks.length === 0) {
      this.showErrorToast('Aucun stock à contrôler dans ce casier');
      return;
    }

    if (!this.activeLocker) {
      return;
    }

    this.bulkCheckComment = '';
    this.checkFlow = 'bulk';

    // Ouvre le casier physiquement
    try {
      await this.scanService.openLocker(this.activeLocker);
      this.messageService.add({
        severity: 'info',
        summary: 'Casier ouvert',
        detail: `Casier ${this.activeLocker} ouvert pour contrôle en masse.`
      });

      // Affiche directement le dialog de contrôle en masse
      this.bulkCheckDialogVisible = true;

    } catch (e) {
      console.error('Erreur ouverture casier (contrôle masse) :', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur casier',
        detail: `Impossible d'ouvrir le casier ${this.activeLocker}.`
      });
    }
  }

  /**
   * Vérifie si au moins un stock du casier n'a pas été contrôlé ce mois-ci
   * @param lockerNumber Numéro du casier
   * @returns true si au moins un stock n'est pas contrôlé ce mois-ci
   */
  needsCheck(lockerNumber: number): boolean {
    const stocks = this.getStocksByLocker(lockerNumber);

    if (stocks.length === 0) {
      return false; // Casier vide, pas besoin de contrôle
    }

    // Début du mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Vérifie si au moins un stock n'a pas été contrôlé ce mois-ci
    return stocks.some(stock => {
      if (!stock.lastCheckDate) {
        return true; // Jamais contrôlé
      }

      // Convertit lastCheckDate en Date
      const lastCheckDate = new Date(stock.lastCheckDate);

      // Si le dernier contrôle est avant le début du mois, il faut contrôler
      return lastCheckDate < startOfMonth;
    });
  }

  /**
   * Confirmation que le casier a été refermé
   * Exécute ensuite l'enregistrement du contrôle
   */
  async confirmLockerClosed(): Promise<void> {
    this.lockerCloseDialogVisible = false;

    if (this.pendingStatus === null) {
      return;
    }

    // Exécute le contrôle selon le flow
    if (this.checkFlow === 'individual') {
      await this.executeIndividualCheck(this.pendingStatus);
    } else if (this.checkFlow === 'bulk') {
      await this.executeBulkCheck(this.pendingStatus);
    }

    this.pendingStatus = null;
  }

  async openAllLockers(): Promise<void> {
    try {
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
        summary: 'Tous les casiers',
        detail: 'Tous les casiers ont été ouverts'
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur globale',
        detail: 'Erreur lors de l\'ouverture des casiers'
      });
    }
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
   * Clic sur OK/NOK/HS pour contrôle individuel
   * Ferme le dialog et demande confirmation fermeture casier
   */
  confirmCheck(status: number): void {
    this.pendingStatus = status;
    this.checkDialogVisible = false;
    this.lockerCloseDialogVisible = true;
  }

  /**
   * Clic sur Tous OK/NOK/HS pour contrôle en masse
   * Ferme le dialog et demande confirmation fermeture casier
   */
  confirmBulkCheck(status: number): void {
    this.pendingStatus = status;
    this.bulkCheckDialogVisible = false;
    this.lockerCloseDialogVisible = true;
  }

  /**
   * Exécution du contrôle INDIVIDUEL après confirmation fermeture
   */
  private async executeIndividualCheck(status: number): Promise<void> {
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
      this.checkFlow = null;

    } catch (error) {
      console.error('Error adding check:', error);
      this.showErrorToast('Erreur lors de l\'enregistrement du contrôle');
    }
  }

  /**
   * Exécution du contrôle EN MASSE après confirmation fermeture
   */
  private async executeBulkCheck(status: number): Promise<void> {
    if (this.lockerStocks.length === 0) {
      this.showErrorToast('Aucun stock à contrôler');
      return;
    }

    const appUser = this.authApp.getCurrentUser();
    if (!appUser) {
      this.showErrorToast('Vous devez être connecté pour réaliser un contrôle');
      return;
    }

    const checkDate = new Date().toISOString();
    let successCount = 0;
    let errorCount = 0;

    // Boucle sur tous les stocks du casier
    for (const stock of this.lockerStocks) {
      try {
        const payload: any = {
          id: null,
          date: checkDate,
          status,
          comment: this.bulkCheckComment || '',
          user: { id: appUser.id },
          stock: { id: stock.id }
        };

        // 1. Crée le check
        const savedCheck: any = await this.checkService.createCheck(payload);

        // 2. Prépare les données PDF
        const pdfData: CheckPdfData = {
          checkDate: checkDate,
          productName: stock.product?.title || 'Produit inconnu',
          alitracer: stock.alitracer || '',
          reference: stock.reference || '',
          lockerNumber: stock.lockerNumber,
          status: status,
          comment: this.bulkCheckComment || '',
          controlledBy: appUser.username,
          brand: stock.product?.brand || 'N/A',
          cmu: stock.product?.cmu || 'N/A',
          size: stock.product?.size || 'N/A'
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
          stock,
          status,
          this.bulkCheckComment,
          appUser.username
        );

        // Met à jour le statut local
        stock.status = status;
        const stockInList = this.allStocks.find(s => s.id === stock.id);
        if (stockInList) {
          stockInList.status = status;
        }

        successCount++;

      } catch (error) {
        console.error(`Erreur contrôle stock ${stock.alitracer}:`, error);
        errorCount++;
      }
    }

    // Toast de résultat
    if (successCount > 0) {
      this.messageService.add({
        severity: 'success',
        summary: 'Contrôles enregistrés',
        detail: `${successCount} contrôle(s) réalisé(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`
      });
    }

    if (errorCount > 0 && successCount === 0) {
      this.showErrorToast(`Échec du contrôle en masse (${errorCount} erreur(s))`);
    }

    await this.checkService.refreshData();
    await this.loadLockers();
    await this.loadLastCheckDates();
    this.buildLockersMapAndStats();
    await this.loadMonthlyExcelFiles();

    this.lockerDetailsDialogVisible = false;
    this.bulkCheckComment = '';
    this.checkFlow = null;
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
}
