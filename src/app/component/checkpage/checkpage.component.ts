import { Component, OnInit } from '@angular/core';
import {
  NgForOf,
  NgIf,
  NgClass
} from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule
} from '@angular/forms';

import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';

import { faListCheck } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { CheckService } from '../../services/check.service';
import { StockService } from '../../services/stock.service';
import { AuthAppService } from '../../services/auth-app.service';

interface Product {
  title: string;
  type: string;
  size: string;
  cmu: string;
  location: string;
  picture: string;
  brand?: string;
}

interface Stock {
  id: number;
  alitracer: string;
  lockerNumber: number;
  status: number | null;
  product: Product;
}

@Component({
  selector: 'app-checkpage',
  standalone: true,
  imports: [
    NgForOf,
    NgIf,
    NgClass,
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

  // 24 casiers avec leurs stocks
  lockers: { number: number; stocks: Stock[] }[] = [];

  // Stock sélectionné pour contrôle (popup)
  selectedStockForCheck: Stock | null = null;

  // Commentaire saisi dans le popup
  checkComment = '';

  // Visibilité du dialog de contrôle
  checkDialogVisible = false;

  protected readonly faListCheck = faListCheck;

  constructor(
    private checkService: CheckService,
    private messageService: MessageService,
    private stockService: StockService,
    private authApp: AuthAppService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadLockers();
  }

  isLoggedIn(): boolean {
    return this.authApp.isLoggedIn();
  }

  /**
   * Chargement des stocks et distribution dans les 24 casiers
   */
  private async loadLockers(): Promise<void> {
    await this.checkService.refreshStocks();
    const allStocks: any[] = this.checkService.getStocks(); // adapte si nécessaire

    // On mappe en Stock fortement typé si besoin
    const mappedStocks: Stock[] = allStocks.map(s => ({
      id: s.id,
      alitracer: s.alitracer,
      lockerNumber: s.lockerNumber,
      status: s.status,
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

    this.lockers = [];
    for (let n = 1; n <= 24; n++) {
      this.lockers.push({
        number: n,
        stocks: mappedStocks.filter(st => st.lockerNumber === n)
      });
    }
  }

  /**
   * Ouverture du dialog de contrôle pour un stock donné
   */
  openCheckDialog(stock: Stock): void {
    this.selectedStockForCheck = stock;
    this.checkComment = '';
    this.checkDialogVisible = true;
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
   * Validation du contrôle (OK / NOK / HS)
   */
  async confirmCheck(status: number): Promise<void> {
    if (!this.selectedStockForCheck) {
      this.showErrorToast('Aucun produit sélectionné pour le contrôle');
      return;
    }

    const appUser = this.authApp.getCurrentUser();
    if (!appUser) {
      this.showErrorToast('Vous devez être connecté pour réaliser un contrôle');
      return;
    }

    const payload: any = {
      id: null,
      date: new Date().toISOString(),
      status,
      comment: this.checkComment || '',
      user: { id: appUser.id },
      stock: { id: this.selectedStockForCheck.id }
    };

    try {
      await this.checkService.createCheck(payload);
      this.showAddToast();

      // Met à jour le statut côté front
      this.selectedStockForCheck.status = status;

      // Rafraîchit les données complètes
      await this.checkService.refreshData();
      await this.loadLockers();

      // Ferme le dialog
      this.checkDialogVisible = false;
      this.selectedStockForCheck = null;
      this.checkComment = '';
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
}
