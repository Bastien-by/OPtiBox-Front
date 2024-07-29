import {Component, OnInit} from '@angular/core';
import {ScanService} from "../../services/scan.service";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {ButtonModule} from "primeng/button";
import {DialogModule} from "primeng/dialog";
import {ToastModule} from "primeng/toast";
import {MessageService} from "primeng/api";
import {StockService} from "../../services/stock.service";
import {
  faArrowRightFromBracket,
  faArrowRightToBracket,
  faBarcode
} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";

@Component({
  selector: 'app-scanpage',
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
  templateUrl: './scanpage.component.html',
  providers: [MessageService],
  styleUrl: './scanpage.component.css'
})
export class ScanpageComponent implements OnInit{

  availableStocks: any[] = [];
  loanedStocks: any[] = [];

  stock: any = {
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
  }

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
  }

  scan: any = {
    badge: '',
  }

  user: any = {
    username: '',
    token: '',
  }

  users: any[] = [];


  history: any = {
    stock: {
      id : '',
    },
    user: {
      id: '',
    },
    date: '',
    type: 'withdraw',
  }



  dialog1Visible: boolean = false;
  dialog2Visible: boolean = false;

  responsiveOptions: any[] | undefined;

  constructor(protected scanService: ScanService, private messageService: MessageService, private stockService: StockService) {}

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
    this.scanService.refreshAvailableStocks();
    this.scanService.refreshLoanedStocks();
    this.availableStocks = this.scanService.getAvailableStocks();
    this.loanedStocks = this.scanService.getLoanedStocks();
  }

  async detectBadge() {
    this.users = this.scanService.getUsers();
    let badgeExist = false;

    this.users.forEach((user: any) => {
      if(user.token === this.scan.badge){
        this.user = user;
        console.log(this.user);
        this.showFindToast();
        badgeExist = true;
      }
    });

    if(this.scan.badge.trim().length === 0){
      this.showEmptyFormToast();
      return
    }

    if(!badgeExist){
      this.showErrorToast();
      return;
    }

    try {
      await this.scanService.refreshData();
      this.updateAvailableStocks();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }


  setType(type: string){
    this.resetSelectedStock();
    this.history.type = type;
  }

  async detectStock() {
    this.review = this.stockService.getStockById(this.stock.id);
    console.log(this.review);
  }

  async addScan(type: string) {
    // vérifier si l'utilisateur est connecté
    if(this.user.username === ''){
      this.showErrorToast();
      return;
    }

    // get date
    let date = new Date();
    // serialize date as java Date
    this.history.date = date.toISOString();
    this.history.user.id = this.user.id;
    this.history.stock.id = this.stock.id;
    this.history.type = type;

    try {
      await this.scanService.createHistory(this.history);
      this.showAddToast();
      await this.scanService.refreshData(); // Attendre que les données soient rafraîchies
      this.updateAvailableStocks();
    } catch (error) {
      console.error('Error adding scan:', error);
    }

    this.stock.id = '';
    this.history.stock.id = '';
  }


  async updateAvailableStocks() {
    await this.scanService.refreshAvailableStocks();
    await this.scanService.refreshLoanedStocks();
    this.availableStocks = this.scanService.getAvailableStocks();
    this.loanedStocks = this.scanService.getLoanedStocks();
  }

  resetSelectedStock(){
    this.stock = {
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
    }

    this.history = {
      stock: {
        id : '',
      },
      user: {
        id: '',
      },
      date: '',
      type: 'withdraw',
    }

    this.review = {
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
    }

  }


  disconnect(){
    this.user = {
      username: '',
      token: '',
    }
  }

  showAddToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Vous avez sorti un élement du stock' });
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

  protected readonly faBarcode = faBarcode;
  protected readonly faArrowRightToBracket = faArrowRightToBracket;
  protected readonly faArrowRightFromBracket = faArrowRightFromBracket;
}
