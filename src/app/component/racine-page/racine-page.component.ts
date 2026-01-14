import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { DatePipe, NgClass, NgIf } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { HttpClient } from '@angular/common/http';
import {
  faBarcode,
  faBox,
  faBoxesStacked,
  faClockRotateLeft,
  faListCheck,
  faPeopleGroup,
  faList,
  faDoorOpen,
  faFilePdf
} from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { StockService } from '../../services/stock.service';
import { CheckService } from '../../services/check.service';
import { AuthAppService } from '../../services/auth-app.service';

@Component({
  selector: 'app-racine-page',
  standalone: true,
  imports: [RouterModule, NgClass, ToastModule, FaIconComponent, DatePipe, NgIf],
  templateUrl: './racine-page.component.html',
  providers: [MessageService],
  styleUrls: ['./racine-page.component.css']
})
export class RacinePageComponent implements OnInit {

  nbStocksOK = 0;
  nbStocksNOK = 0;
  nbStocksHS = 0;

  lastCheck: any = {
    date: null,
    status: null,
    pdfFilename: null
  };

  /** État du téléchargement PDF */
  isDownloading = false;

  constructor(
    private messageService: MessageService,
    private stockService: StockService,
    private checkService: CheckService,
    private router: Router,
    private authApp: AuthAppService,
    private httpClient: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    await this.stockService.refreshStocks();
    this.updateStockCounts();

    await this.checkService.getChecks();
    this.loadLastCheck();
  }

  /**
   * Charger le dernier contrôle depuis l'API
   */
  loadLastCheck(): void {
    this.httpClient.get<any>('api/checks/last').subscribe({
      next: (response) => {
        this.lastCheck = response;
        console.log('Dernier contrôle chargé:', this.lastCheck);
      },
      error: (error) => {
        console.error('Erreur chargement dernier contrôle:', error);
        // Fallback sur l'ancien système si l'API ne répond pas
        this.lastCheck = this.checkService.getLastCheck();
      }
    });
  }

  /**
   * Télécharger le dernier PDF
   */
  downloadLastPdf(): void {
    if (!this.lastCheck.pdfFilename) {
      this.messageService.add({
        severity: 'warn',
        summary: 'PDF non disponible',
        detail: 'Aucun PDF associé à ce contrôle'
      });
      return;
    }

    this.isDownloading = true;

    // Télécharger le PDF depuis le backend
    this.httpClient.get(`api/pdf/download/${this.lastCheck.pdfFilename}`, {
      responseType: 'blob'
    }).subscribe({
      next: (blob: Blob) => {
        // Créer un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = this.lastCheck.pdfFilename;
        link.click();

        // Nettoyer
        window.URL.revokeObjectURL(url);

        this.isDownloading = false;

        this.messageService.add({
          severity: 'success',
          summary: '✅ PDF téléchargé',
          detail: this.lastCheck.pdfFilename
        });

        console.log('✅ PDF téléchargé:', this.lastCheck.pdfFilename);
      },
      error: (error) => {
        console.error('❌ Erreur téléchargement PDF:', error);
        this.isDownloading = false;

        this.messageService.add({
          severity: 'error',
          summary: 'Erreur téléchargement',
          detail: 'Impossible de télécharger le PDF'
        });
      }
    });
  }

  updateStockCounts() {
    this.nbStocksOK = 0;
    this.nbStocksNOK = 0;
    this.nbStocksHS = 0;
    this.stockService.getAllStocks().forEach(stock => {
      if (stock.status === 1) {
        this.nbStocksOK++;
      } else if (stock.status === 0) {
        this.nbStocksNOK++;
      } else if (stock.status === 2) {
        this.nbStocksHS++;
      }
    });
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

  isOperator(): boolean {
    return this.authApp.isOperator();
  }

  getUsername(): string {
    return this.authApp.getUsername();
  }

  navigateOrShowToast(route: string, hasPermission: boolean) {
    if (hasPermission) {
      this.router.navigate([route]);
    } else {
      this.showErrorRoleToast();
    }
  }

  showErrorRoleToast() {
    this.messageService.add({
      severity: 'error',
      summary: 'Accès non autorisé',
      detail: 'Vous devez être connecté ou avoir les droits nécessaires pour accéder à cette page'
    });
  }

  protected readonly faBarcode = faBarcode;
  protected readonly faListCheck = faListCheck;
  protected readonly faClockRotateLeft = faClockRotateLeft;
  protected readonly faBox = faBox;
  protected readonly faBoxesStacked = faBoxesStacked;
  protected readonly faPeopleGroup = faPeopleGroup;
  protected readonly faList = faList;
  protected readonly faDoorOpen = faDoorOpen;
  protected readonly faFilePdf = faFilePdf;
}
