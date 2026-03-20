import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf, NgClass } from '@angular/common';

import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faDoorOpen, faDoorClosed, faLockOpen, faLock } from '@fortawesome/free-solid-svg-icons';

import { ScanService } from '../../services/scan.service';
import { AuthAppService } from '../../services/auth-app.service';

interface LockerState {
  number: number;
  isOpen: boolean;
  isLoading: boolean;
}

@Component({
  selector: 'app-lockerpage',
  standalone: true,
  templateUrl: './lockerpage.component.html',
  styleUrls: ['./lockerpage.component.css'],
  imports: [NgForOf, NgIf, NgClass, ToastModule, FaIconComponent],
  providers: [MessageService]
})
export class LockerpageComponent implements OnInit {

  /** État de chacun des 24 casiers. */
  lockers: LockerState[] = [];

  /** true pendant l'exécution de "Ouvrir tout" / "Fermer tout". */
  allLockersLoading = false;

  /** true si tous les casiers sont considérés ouverts. */
  allOpen = false;

  // ── Icônes ────────────────────────────────────────────────────────────────
  protected readonly faDoorOpen   = faDoorOpen;
  protected readonly faDoorClosed = faDoorClosed;
  protected readonly faLockOpen   = faLockOpen;
  protected readonly faLock       = faLock;

  constructor(
    private scanService: ScanService,
    private authApp: AuthAppService,
    private messageService: MessageService
  ) {}

  /** Nombre de casiers actuellement ouverts. Utilisé dans le template. */
  get openCount(): number {
    return this.lockers.filter(l => l.isOpen).length;
  }

  ngOnInit(): void {
    // Initialise les 24 casiers, tous fermés au départ
    this.lockers = Array.from({ length: 24 }, (_, i) => ({
      number:    i + 1,
      isOpen:    false,
      isLoading: false
    }));
  }

  isLoggedIn() { return this.authApp.isLoggedIn(); }
  isAdmin()    { return this.authApp.isAdmin(); }

  // ── Colonnes de la grille (même disposition que scanpage) ─────────────────

  readonly columns: number[][] = [
    [1, 2, 3],
    [4, 5],
    [6, 7, 8],
    [9, 10],
    [11, 12, 13, 14, 15],
    [16, 17, 18],
    [19, 20, 21],
    [22, 23, 24]
  ];

  getLocker(num: number): LockerState {
    return this.lockers[num - 1];
  }

  // ── Hauteur des cellules selon la colonne (identique à scanpage) ──────────

  cellHeight(colIndex: number): string {
    // Colonnes 2 et 4 (index 1 et 3) → cases plus hautes
    if (colIndex === 1 || colIndex === 3) return 'h-40 sm:h-44';
    // Colonne 5 (index 4) → cases plus petites
    if (colIndex === 4) return 'h-24 sm:h-28';
    return 'h-32 sm:h-36';
  }

  // ── Clic sur un casier : toggle ouvrir / fermer ────────────────────────────

  async toggleLocker(num: number): Promise<void> {
    const locker = this.getLocker(num);
    if (locker.isLoading || this.allLockersLoading) return;

    locker.isLoading = true;

    try {
      if (locker.isOpen) {
        await this.scanService.closeLocker(num);
        locker.isOpen = false;
        this.messageService.add({
          severity: 'info',
          summary:  `Casier ${num} fermé`,
          detail:   `Le casier ${num} a été fermé.`
        });
      } else {
        await this.scanService.openLocker(num);
        locker.isOpen = true;
        this.messageService.add({
          severity: 'success',
          summary:  `Casier ${num} ouvert`,
          detail:   `Le casier ${num} a été ouvert.`
        });
      }
      this.updateAllOpenState();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary:  'Erreur',
        detail:   `Impossible de ${locker.isOpen ? 'fermer' : 'ouvrir'} le casier ${num}.`
      });
    } finally {
      locker.isLoading = false;
    }
  }

  // ── Ouvrir / fermer TOUS les casiers ─────────────────────────────────────

  async toggleAllLockers(): Promise<void> {
    if (this.allLockersLoading) return;

    this.allLockersLoading = true;

    try {
      if (this.allOpen) {
        // Fermer tous
        await this.scanService.closeAllLockers();
        this.lockers.forEach(l => l.isOpen = false);
        this.allOpen = false;
        this.messageService.add({
          severity: 'info',
          summary:  'Tous les casiers fermés',
          detail:   'La commande de fermeture a été envoyée à tous les casiers.'
        });
      } else {
        // Ouvrir tous
        await this.scanService.openAllLockers();
        this.lockers.forEach(l => l.isOpen = true);
        this.allOpen = true;
        this.messageService.add({
          severity: 'success',
          summary:  'Tous les casiers ouverts',
          detail:   'La commande d\'ouverture a été envoyée à tous les casiers.'
        });
      }
    } catch {
      this.messageService.add({
        severity: 'error',
        summary:  'Erreur',
        detail:   `Impossible d'envoyer la commande ${this.allOpen ? 'de fermeture' : 'd\'ouverture'} globale.`
      });
    } finally {
      this.allLockersLoading = false;
    }
  }

  private updateAllOpenState(): void {
    this.allOpen = this.lockers.every(l => l.isOpen);
  }
}
