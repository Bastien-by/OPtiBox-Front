import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { DatePipe, NgClass, NgIf } from '@angular/common';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  faBarcode,
  faBox,
  faBoxesStacked,
  faClockRotateLeft,
  faListCheck,
  faPeopleGroup,
  faList,
  faDoorOpen
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
    status: null
  };

  /** Résultat du test NFC */
  nfcResult: string | null = null;
  /** Statut de lecture NFC en cours */
  nfcScanning = false;

  constructor(
    private messageService: MessageService,
    private stockService: StockService,
    private checkService: CheckService,
    private router: Router,
    private authApp: AuthAppService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.stockService.refreshStocks();
    this.updateStockCounts();

    await this.checkService.getChecks();
    this.lastCheck = this.checkService.getLastCheck();
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

  /** Lecture réelle NFC avec Web NFC API */
  async testNFC(): Promise<void> {
    // Vérifier support NFC
    if (!('NDEFReader' in window)) {
      this.messageService.add({
        severity: 'warn',
        summary: '⚠️ NFC non supporté',
        detail: 'Votre navigateur/tablette ne supporte pas la lecture NFC. Utilisez Chrome Android récent.'
      });
      return;
    }

    if (this.nfcScanning) {
      this.messageService.add({
        severity: 'info',
        summary: '⏳ Lecture en cours',
        detail: 'Approchez un autre tag NFC...'
      });
      return;
    }

    this.nfcResult = null;
    this.nfcScanning = true;

    try {
      const reader = new (window as any).NDEFReader();

      this.messageService.add({
        severity: 'info',
        summary: '🪪 Lecture NFC',
        detail: 'Approchez un tag NFC de la tablette...'
      });

      // Écoute des tags NFC
      reader.addEventListener('reading', (event: any) => {
        console.log('NFC Tag détecté:', event);

        // Extraire le contenu du tag (premier record NDEF)
        const message = event.message;
        let tagContent = '';

        if (message && message.length > 0) {
          const record = message[0];
          tagContent = new TextDecoder().decode(record.data || new Uint8Array());
        }

        // Fallback si pas de NDEF : utiliser l'ID du tag
        if (!tagContent && event.serialNumber) {
          tagContent = `ID: ${event.serialNumber}`;
        }

        this.nfcResult = tagContent || 'Tag vide';
        this.nfcScanning = false;

        this.messageService.add({
          severity: 'success',
          summary: '✅ Tag NFC lu',
          detail: `Contenu: ${this.nfcResult}`
        });

        console.log('Tag NFC complet:', {
          id: event.serialNumber,
          content: tagContent,
          records: message
        });
      });

      // Scan pendant 30 secondes max
      await reader.scan({ signal: AbortSignal.timeout(30000) });

    } catch (error: any) {
      this.nfcScanning = false;

      if (error.name === 'AbortError') {
        this.messageService.add({
          severity: 'info',
          summary: '⏹️ Scan arrêté',
          detail: 'Temps maximum écoulé (30s)'
        });
      } else if (error.name === 'NotAllowedError') {
        this.messageService.add({
          severity: 'error',
          summary: '🚫 NFC refusé',
          detail: 'Activez NFC et autorisez la lecture'
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: '❌ Erreur NFC',
          detail: error.message || 'Erreur inconnue'
        });
        console.error('Erreur NFC:', error);
      }
    }
  }

  protected readonly faBarcode = faBarcode;
  protected readonly faListCheck = faListCheck;
  protected readonly faClockRotateLeft = faClockRotateLeft;
  protected readonly faBox = faBox;
  protected readonly faBoxesStacked = faBoxesStacked;
  protected readonly faPeopleGroup = faPeopleGroup;
  protected readonly faList = faList;
  protected readonly faDoorOpen = faDoorOpen;
}
