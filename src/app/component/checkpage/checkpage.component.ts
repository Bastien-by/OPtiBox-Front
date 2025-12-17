import { Component, OnInit } from '@angular/core';
import { NgForOf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { faListCheck } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';

import { CheckService } from '../../services/check.service';
import { StockService } from '../../services/stock.service';
import { AuthAppService } from '../../services/auth-app.service';

@Component({
  selector: 'app-checkpage',
  standalone: true,
  imports: [
    NgForOf,
    ReactiveFormsModule,
    FormsModule,
    CarouselModule,
    TagModule,
    ButtonModule,
    DialogModule,
    ToastModule,
    FaIconComponent
  ],
  templateUrl: './checkpage.component.html',
  providers: [MessageService],
  styleUrls: ['./checkpage.component.css']
})
export class CheckpageComponent implements OnInit {

  stocksArray: any[] = [];

  check: any = {
    id: '',
    date: '',
    status: '',
    user: {
      id: ''
    },
    stock: {
      id: ''
    },
    comment: ''
  };

  review: any = {
    product: {
      title: '',
      type: '',
      size: '',
      cmu: '',
      location: '',
      picture: ''
    },
    available: null,
    status: null,
    creationDate: null,
    lastCheckDate: null
  };

  stock: any = {
    id: '',
    alitracer: ''
  };

  responsiveOptions: any[] | undefined;

  constructor(
    protected checkService: CheckService,
    private messageService: MessageService,
    private stockService: StockService,
    private authApp: AuthAppService
  ) {}

  ngOnInit(): void {
    this.responsiveOptions = [
      { breakpoint: '1400px', numVisible: 3, numScroll: 3 },
      { breakpoint: '1220px', numVisible: 2, numScroll: 2 },
      { breakpoint: '1100px', numVisible: 1, numScroll: 1 }
    ];
    this.checkService.refreshStocks();
    this.stocksArray = this.checkService.getStocks();
  }
  isLoggedIn(): boolean {
    return this.authApp.isLoggedIn();
  }

  async detectStock(): Promise<void> {
    if (this.stock.id) {
      this.review = this.stockService.getStockById(this.stock.id);
    } else if (this.stock.alitracer) {
      this.review = this.stockService.getStockByAlitracer(this.stock.alitracer);
    } else {
      return;
    }

    console.log(this.review);
    this.getLatestDate();
  }

  async setStatus(status: number, stockId: number): Promise<void> {
    this.check.status = status;
    console.log('Stock ID : ' + stockId);

    const appUser = this.authApp.getCurrentUser();
    if (!appUser) {
      this.showErrorToast('Vous devez être connecté pour réaliser un contrôle');
      return;
    }

    const date = new Date();
    this.check.date = date.toISOString();
    this.check.user.id = appUser.id;
    this.check.stock.id = this.stock.id;

    try {
      await this.checkService.createCheck(this.check);
      this.showAddToast();
      await this.checkService.refreshData();
      this.updateStocks();
      this.review.status = status;
    } catch (error) {
      console.error('Error adding check:', error);
    }

    this.resetForm();
    this.getLatestDate();
  }

  resetForm(): void {
    this.stock.id = null;
    this.stock.alitracer = '';
    this.review = {};
    this.check = {
      id: null,
      stock: { id: '' },
      user: { id: '' },
      status: '',
      date: '',
      comment: ''
    };
    this.stocksArray = [];
  }

  getStatusClass(): string {
    return this.checkService.getStatusClass(this.review);
  }

  async updateStocks(): Promise<void> {
    await this.checkService.refreshStocks();
    this.stocksArray = this.checkService.getStocks();
  }

  getLatestDate(): void {
    this.stockService.getCheckIdByStockId(this.stock.id).subscribe({
      next: checks => {
        if (checks.length > 0) {
          const latestCheck = checks.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )[0];
          this.review.lastCheckDate = new Date(latestCheck.date).toLocaleString();
          console.log('Dernière date de check:', this.review.lastCheckDate);
        } else {
          this.review.lastCheckDate = 'Aucune donnée disponible';
        }
      },
      error: err => {
        console.error('Erreur lors de la récupération des checks:', err);
      }
    });
  }

  showAddToast(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Success',
      detail: 'Vous avez réalisé un contrôle sur un produit'
    });
  }

  showErrorToast(detail: string = 'Badge non reconnu'): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Error',
      detail
    });
  }

  showEmptyFormToast(): void {
    this.messageService.add({
      severity: 'warn',
      summary: 'Error',
      detail: 'Le champ ne peut pas être vide'
    });
  }

  protected readonly faListCheck = faListCheck;
}
