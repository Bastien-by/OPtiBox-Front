import {Component, OnInit} from '@angular/core';
import {CheckService} from "../../services/check.service";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {ButtonModule} from "primeng/button";
import {DialogModule} from "primeng/dialog";
import {ToastModule} from "primeng/toast";
import {MessageService} from "primeng/api";
import {faListCheck} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import {StockService} from "../../services/stock.service";

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
  styleUrl: './checkpage.component.css'
})
export class CheckpageComponent implements OnInit{

  stocksArray: any[] = [];

  check: any = {
    id: '',
    date: '',
    status: '',
    badge: '',
    user: {
      id: '',
    },
    stock: {
      id: '',
    },
    comment: '',
  };

  review: any = {
    product: {
      title: '',
      type: '',
      size: '',
      cmu: '',
      location: '',
      picture: '',
    },
    available: null,
    status: null,
    creationDate: null,
    lastCheckDate: null,
  }

  stock: any = {
    id: '',
  }

  scan: any = {
    badge: '',
  }

  user: any = {
    id: '',
    username: '',
    token: '',
  }

  users: any[] = [];

  responsiveOptions: any[] | undefined;

  constructor(protected checkService: CheckService, private messageService: MessageService, private stockService: StockService) {}

  ngOnInit(){
    this.responsiveOptions = [
      {
        breakpoint: '1400px',
        numVisible: 3,
        numScroll: 3
      },
      {
        breakpoint: '1220px',
        numVisible: 2,
        numScroll: 2
      },
      {
        breakpoint: '1100px',
        numVisible: 1,
        numScroll: 1
      }
    ];
    this.checkService.refreshStocks();
    this.stocksArray = this.checkService.getStocks();
  }

  async detectBadge() {
    this.users = this.checkService.getUsers();
    let badgeExist = false;

    if (this.check.badge.trim().length === 0) {
      this.showEmptyFormToast();
      return;
    }

    this.users.forEach((user: any) => {
      if(user.token === this.check.badge){
        this.user = user;
        console.log(this.user);
        this.showFindToast();
        badgeExist = true;
      }
    });
    if(!badgeExist){
      this.showErrorToast();
      return;
    }

    try {
      await this.checkService.refreshData();
      this.updateStocks();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }

  async detectStock() {
    this.review = this.stockService.getStockById(this.stock.id);
    console.log(this.review);
    this.getLatestDate();
  }


  async setStatus(status: number, stockId: number){
    this.check.status = status;
    console.log("Stock ID : " + stockId);   
    // vérifier si l'utilisateur est connecté
    if(this.user.username === ''){
      this.showErrorToast();
      return;
    }
    // get date
    let date = new Date();
    // serialize date as java Date
    this.check.date = date.toISOString();
    this.check.user.id = this.user.id;
    this.check.stock.id = this.stock.id;

    try {
      // Appeler la fonction pour créer le check
      await this.checkService.createCheck(this.check);
      this.showAddToast();
      await this.checkService.refreshData(); // Attendre que les données soient rafraîchies
      this.updateStocks();
      this.review.status = status;
    } catch (error) {
      console.error('Error adding check:', error);
    }
    this.resetForm();
    this.getLatestDate(); 
  }

  
  resetForm() {
    this.stock.id = null; // Réinitialise le champ de sélection
    this.review = {}; // Réinitialise les données du produit affiché
    this.check = {     // Réinitialise l'objet `check`
      id: null,
      stock: { id: '' },
      user: { id: '' },
      status: '',
      date: '',
      comment: '',
    };
    this.stocksArray = [];
  }

  getStatusClass(): string {
    return this.checkService.getStatusClass(this.review);
  }

  async updateStocks() {
    await this.checkService.refreshStocks();
    this.stocksArray = this.checkService.getStocks();
  }

  getLatestDate(){
    this.stockService.getCheckIdByStockId(this.stock.id).subscribe({
      next: (checks) => {
        if (checks.length > 0) {
          const latestCheck = checks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          // Assigner la dernière date de check à review.lastCheckDate
          this.review.lastCheckDate = new Date(latestCheck.date).toLocaleString();
          console.log('Dernière date de check:', this.review.lastCheckDate);
        } else {
          this.review.lastCheckDate = 'Aucune donnée disponible';
        }
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des checks:', err);
      }
    });
  }


  disconnect(){
    this.user = {
      username: '',
      token: '',
    }
  }

  showAddToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Vous avez réalisé un contrôle sur un produit' });
  }

  showFindToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Badge reconnu. Bonjour ' + this.user.username });
  }

  showErrorToast(){
    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Badge non reconnu' });
  }

  showEmptyFormToast(){
    this.messageService.add({ severity: 'warn', summary: 'Error', detail: 'Le champ ne peut pas être vide' });
  }

  protected readonly faListCheck = faListCheck;
}
