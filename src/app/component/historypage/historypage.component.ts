import { Component, OnInit } from '@angular/core';
import { HistoryService } from '../../services/history.service';
import { NgForOf, NgIf, NgClass, NgOptimizedImage } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import {
  faArrowRightFromBracket,
  faArrowRightToBracket,
  faClockRotateLeft,
  faListCheck,
  faFilePdf
} from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-historypage',
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    NgClass,
    ReactiveFormsModule,
    FormsModule,
    CarouselModule,
    TagModule,
    FaIconComponent
  ],
  templateUrl: './historypage.component.html',
  providers: [MessageService],
  styleUrl: './historypage.component.css'
})
export class HistorypageComponent implements OnInit {

  // Onglet courant
  tab: 'withdraw' | 'deposit' | 'check' = 'withdraw';

  // Pagination
  currentPage = 1;
  itemsPerPage = 30;

  // Données brutes de l’onglet courant
  allHistory: any[] = [];

  // Données filtrées
  filteredHistory: any[] = [];

  // Filtres
  filterUser = '';
  filterMonth: string = '';   // '1'..'12'
  filterYear: string = '';    // '2025', '2026', ...

  filterStatus: string = '';          // uniquement pour "check"

  // Liste des utilisateurs pour le select
  users: string[] = [];
  months = [
    { value: '1',  label: 'Janvier' },
    { value: '2',  label: 'Février' },
    { value: '3',  label: 'Mars' },
    { value: '4',  label: 'Avril' },
    { value: '5',  label: 'Mai' },
    { value: '6',  label: 'Juin' },
    { value: '7',  label: 'Juillet' },
    { value: '8',  label: 'Août' },
    { value: '9',  label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' }
  ];
  years: string[] = [];

  constructor(
    protected historyService: HistoryService,
    private httpClient: HttpClient
  ) {}

  async ngOnInit(): Promise<void> {
    await this.historyService.refreshHistory();
    // Onglet par défaut : retraits
    this.setType('withdraw');
  }

  setType(type: 'withdraw' | 'deposit' | 'check'): void {
    this.tab = type;
    this.currentPage = 1;

    if (type === 'withdraw') {
      this.allHistory = this.historyService.getAllWithdrawHistory();
    } else if (type === 'deposit') {
      this.allHistory = this.historyService.getAllDepositHistory();
    } else {
      this.allHistory = this.historyService.getAllCheckHistory();
    }

    this.buildUsersList();
    this.buildYearsList();
    this.applyFilters();
  }


  private buildYearsList(): void {
    const ys = this.allHistory
      .map(h => h.date ? new Date(h.date).getFullYear() : null)
      .filter((y: number | null) => y !== null) as number[];

    this.years = Array.from(new Set(ys))
      .sort((a, b) => b - a)   // années décroissantes
      .map(y => y.toString());
  }


  /**
   * Construit la liste des utilisateurs distincts pour le select
   */
  private buildUsersList(): void {
    const names = this.allHistory
      .map(h => h.user?.username)
      .filter((u: string | undefined) => !!u) as string[];

    this.users = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Applique les filtres sur allHistory
   */
  applyFilters(): void {
    const user = this.filterUser || '';
    const month = this.filterMonth ? Number(this.filterMonth) : null; // 1..12
    const year = this.filterYear ? Number(this.filterYear) : null;
    const statusFilter = this.filterStatus !== '' ? Number(this.filterStatus) : null;

    this.filteredHistory = this.allHistory.filter(h => {
      const username = h.user?.username || '';
      const date = h.date ? new Date(h.date) : null;

      // Utilisateur exact
      if (user && username !== user) {
        return false;
      }

      // Mois / année
      if (date) {
        const m = date.getMonth() + 1; // 1..12
        const y = date.getFullYear();

        if (month !== null && m !== month) {
          return false;
        }
        if (year !== null && y !== year) {
          return false;
        }
      } else if (month !== null || year !== null) {
        // si pas de date mais filtre mois/année actif -> exclu
        return false;
      }

      // Statut (onglet check uniquement)
      if (this.tab === 'check' && statusFilter !== null) {
        if (h.status !== statusFilter) {
          return false;
        }
      }

      return true;
    });

    this.currentPage = 1;
  }

  /**
   * Télécharge le PDF d'un contrôle
   */
  downloadPdf(filename: string): void {
    if (!filename) {
      alert('Aucun PDF associé à ce contrôle');
      return;
    }

    const url = `api/pdf/download/${filename}`;

    this.httpClient.get(url, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        // Crée un lien de téléchargement
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();

        // Nettoie l'URL temporaire
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Erreur téléchargement PDF:', error);
        alert('PDF introuvable sur le serveur');
      }
    });
  }


  resetFilters(): void {
    this.filterUser = '';
    this.filterMonth = '';
    this.filterYear = '';
    this.filterStatus = '';
    this.applyFilters();
  }


  getPaginatedHistory(data: any[]): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return data.slice(startIndex, startIndex + this.itemsPerPage);
  }

  nextPage(totalItems: number): void {
    if (this.currentPage * this.itemsPerPage < totalItems) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  protected readonly faArrowRightFromBracket = faArrowRightFromBracket;
  protected readonly faArrowRightToBracket = faArrowRightToBracket;
  protected readonly faListCheck = faListCheck;
  protected readonly faClockRotateLeft = faClockRotateLeft;
  protected readonly faFilePdf = faFilePdf;
}
