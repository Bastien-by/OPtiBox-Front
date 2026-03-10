import { Component, OnInit, OnDestroy } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { Router } from '@angular/router';

import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faBarcode, faStop, faBoxOpen, faDoorClosed } from '@fortawesome/free-solid-svg-icons';

import { ScanService } from '../../services/scan.service';
import { AuthAppService } from '../../services/auth-app.service';

interface Stock {
  id: number;
  alitracer: string;
  lockerNumber: number;
  available: boolean;
  status: number;
  product: {
    title: string;
    size: string;
    cmu: string;
  };
}

interface LockerGroup {
  locker: number;
  tools: Stock[];
}

@Component({
  selector: 'app-depositpage',
  standalone: true,
  templateUrl: './depositpage.component.html',
  styleUrls: ['./depositpage.component.css'],
  imports: [
    NgForOf,
    NgIf,
    ToastModule,
    DialogModule,
    FaIconComponent
  ],
  providers: [MessageService]
})
export class DepositpageComponent implements OnInit, OnDestroy {

  /* -------- SCAN DOUCHETTE -------- */
  scanDialogVisible = false;
  scannedTools: Stock[] = [];

  /* -------- POLLING -------- */
  private pollingInterval: any;
  private isProcessing = false;

  /* -------- GESTION CASIERS -------- */
  lockerDialogVisible = false;
  currentLocker: number | null = null;
  currentLockerTools: Stock[] = [];
  private lockerQueue: LockerGroup[] = [];
  private currentLockerIndex = 0;

  /* -------- ICONS -------- */
  faBarcode = faBarcode;
  faStop = faStop;
  faBoxOpen = faBoxOpen;
  faDoorClosed = faDoorClosed;

  /* -------- DATA -------- */
  allStocks: Stock[] = [];

  constructor(
    private scanService: ScanService,
    private authService: AuthAppService,
    private messageService: MessageService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadStocks();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /* -------- AUTH -------- */

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  /* -------- CHARGEMENT STOCKS -------- */

  private async loadStocks(): Promise<void> {
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();

    const available = this.scanService.getAvailableStocks();
    const loaned = this.scanService.getLoanedStocks();

    this.allStocks = [...available, ...loaned];
  }

  /* -------- DÉMARRAGE SCAN -------- */

  startDepositScan(): void {
    this.scannedTools = [];
    this.scanDialogVisible = true;
    setTimeout(() => this.startPolling(), 0);
  }

  /* -------- ARRÊT SCAN -------- */

  stopDepositScan(): void {
    this.stopPolling();
    this.scanDialogVisible = false;

    if (this.scannedTools.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Aucun outil scanné',
        detail: 'Vous n\'avez scanné aucun outil à déposer.'
      });
      return;
    }

    this.groupToolsByLocker();
    this.currentLockerIndex = 0;
    this.processNextLocker();
  }

  /* -------- POLLING DOUCHETTE -------- */

  private startPolling(): void {
    console.log('⚡ POLLING START');
    this.scanService.clearScan(); // ✅ Clear initial

    this.pollingInterval = setInterval(async () => { // ✅ async ici
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
            console.log(`✅ SCAN: "${val}"`);

            // ✅ LOCK immédiatement
            this.isProcessing = true;

            // ✅ Traite le code
            await this.handleScannedCode(val);
          }
        }
      } catch (err) {
        console.error('❌ Erreur poll:', err);
        this.isProcessing = false; // ✅ Débloque en cas d'erreur
      }
    }, 1250);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('⏹️ POLLING STOP');
    }
    this.isProcessing = false;
  }

  /* -------- TRAITEMENT SCAN -------- */

  private async handleScannedCode(decodedText: string): Promise<void> {
    try {
      const alitracer = decodedText.trim();

      // ✅ Déjà scanné
      if (this.scannedTools.some(t => t.alitracer === alitracer)) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Déjà scanné',
          detail: `L'outil ${alitracer} a déjà été scanné.`
        });
        return;
      }

      // ✅ Cherche le stock
      const stock = this.allStocks.find(s => s.alitracer === alitracer);

      if (!stock) {
        this.messageService.add({
          severity: 'error',
          summary: 'Outil inconnu',
          detail: `L'alitracer ${alitracer} ne correspond à aucun outil.`
        });
        return;
      }

      // ✅ Déjà disponible
      if (stock.available) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Outil déjà disponible',
          detail: `L'outil ${alitracer} est déjà dans son casier.`
        });
        return;
      }

      // ✅ Outil HS
      if (stock.status === 2) {
        this.messageService.add({
          severity: 'error',
          summary: 'Outil HS',
          detail: `L'outil ${alitracer} est HS et ne peut pas être déposé.`
        });
        return;
      }

      // ✅ Succès
      this.scannedTools.push(stock);

      this.messageService.add({
        severity: 'success',
        summary: 'Outil ajouté',
        detail: `${alitracer} ajouté (Casier ${stock.lockerNumber})`
      });

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

      // ✅ PETITE PAUSE pour être sûr que le buffer est vraiment vidé
      await new Promise(resolve => setTimeout(resolve, 200));

      this.isProcessing = false;
      console.log('🔓 isProcessing = false');
    }
  }



  /* -------- GROUPEMENT PAR CASIER -------- */

  private groupToolsByLocker(): void {
    const grouped = new Map<number, Stock[]>();

    for (const tool of this.scannedTools) {
      if (!grouped.has(tool.lockerNumber)) {
        grouped.set(tool.lockerNumber, []);
      }
      grouped.get(tool.lockerNumber)!.push(tool);
    }

    this.lockerQueue = Array.from(grouped.entries())
      .map(([locker, tools]) => ({ locker, tools }))
      .sort((a, b) => a.locker - b.locker);

    console.log('📦 Casiers à traiter:', this.lockerQueue);
  }

  /* -------- TRAITEMENT SÉQUENTIEL DES CASIERS -------- */

  private async processNextLocker(): Promise<void> {
    console.log(`🔄 Index: ${this.currentLockerIndex} / ${this.lockerQueue.length}`);

    // ✅ Tous les casiers traités
    if (this.currentLockerIndex >= this.lockerQueue.length) {
      console.log('✅ Tous les casiers traités');

      this.messageService.add({
        severity: 'success',
        summary: 'Dépôt terminé',
        detail: 'Tous les outils ont été déposés avec succès.'
      });

      setTimeout(() => {
        this.router.navigate(['/scanpage']);
      }, 2000);

      return;
    }

    // ✅ Récupère le casier actuel
    const currentGroup = this.lockerQueue[this.currentLockerIndex];
    this.currentLocker = currentGroup.locker;
    this.currentLockerTools = currentGroup.tools;

    console.log(`📦 Casier ${this.currentLocker} - ${this.currentLockerTools.length} outil(s)`);

    // ✅ 1. OUVRE LE CASIER
    try {
      await this.scanService.openLocker(this.currentLocker);
      console.log(`🔓 Casier ${this.currentLocker} - Commande ouverture envoyée`);

      this.messageService.add({
        severity: 'success',
        summary: 'Casier ouvert',
        detail: `Casier ${this.currentLocker} ouvert. Rangez les outils.`
      });

    } catch (e) {
      console.error(`❌ Erreur ouverture casier ${this.currentLocker}:`, e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: `Impossible d'ouvrir le casier ${this.currentLocker}.`
      });

      // Passe au suivant même en cas d'erreur
      this.currentLockerIndex++;
      await this.processNextLocker();
      return;
    }

    // ✅ 2. OUVRE LE POP-UP
    this.lockerDialogVisible = true;
  }

  /* -------- FERMETURE CASIER -------- */

  async closeCurrentLocker(): Promise<void> {
    if (!this.currentLocker) {
      console.error('❌ Aucun casier actif');
      return;
    }

    console.log(`🔒 Fermeture casier ${this.currentLocker}`);

    try {
      // ✅ 1. FERME LE POP-UP
      this.lockerDialogVisible = false;

      // ✅ 2. FERME LE CASIER
      await this.scanService.closeLocker(this.currentLocker);
      console.log(`🔒 Casier ${this.currentLocker} - Commande fermeture envoyée`);

      this.messageService.add({
        severity: 'success',
        summary: 'Casier fermé',
        detail: `Casier ${this.currentLocker} fermé avec succès.`
      });

      // ✅ 3. UPDATE STATUT STOCKS (disponible)
      await this.updateStocksAndHistory();

      // ✅ 4. Incrémente l'index
      this.currentLockerIndex++;

      console.log(`➡️ Passage au casier suivant (index ${this.currentLockerIndex})`);

      // ✅ 5. PAUSE 500ms entre la fermeture et l'ouverture suivante
      await new Promise(resolve => setTimeout(resolve, 500));

      // ✅ 6. Traite le casier suivant
      await this.processNextLocker();

    } catch (e) {
      console.error(`❌ Erreur fermeture casier ${this.currentLocker}:`, e);

      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: `Impossible de fermer le casier ${this.currentLocker}.`
      });
    }
  }

  /* -------- UPDATE STATUT + HISTORIQUE -------- */

  private async updateStocksAndHistory(): Promise<void> {
    const appUser = this.authService.getCurrentUser();
    if (!appUser) {
      console.error('❌ Utilisateur non connecté');
      return;
    }

    console.log(`💾 Mise à jour statut + historique pour ${this.currentLockerTools.length} outil(s)`);

    for (const tool of this.currentLockerTools) {
      const history = {
        stock: { id: tool.id },
        user: { id: appUser.id },
        date: new Date().toISOString(),
        type: 'deposit'
      };

      try {
        // ✅ createHistory met automatiquement available = true côté backend
        await this.scanService.createHistory(history);
        console.log(`✅ ${tool.alitracer} - Historique créé + statut mis à jour`);
      } catch (error) {
        console.error(`❌ Erreur pour ${tool.alitracer}:`, error);

        this.messageService.add({
          severity: 'error',
          summary: 'Erreur dépôt',
          detail: `Impossible d'enregistrer le dépôt de ${tool.alitracer}.`
        });
      }
    }

    // ✅ Refresh les données
    await this.scanService.refreshData();
    await this.loadStocks();
  }
}
