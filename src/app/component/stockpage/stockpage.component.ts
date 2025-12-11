import {Component, OnInit} from '@angular/core';
import {StockService} from "../../services/stock.service";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {ButtonModule} from "primeng/button";
import {DialogModule} from "primeng/dialog";
import {ToastModule} from "primeng/toast";
import {MessageService} from "primeng/api";
import { ProductService } from '../../services/product.service';
import {faBoxesStacked} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";
import { CheckService } from '../../services/check.service';
import { HistoryService } from '../../services/history.service';
import { QRCodeModule } from 'angularx-qrcode';


@Component({
  selector: 'app-stockpage',
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
    FaIconComponent,
    QRCodeModule,
  ],
  templateUrl: './stockpage.component.html',
  providers: [MessageService],
  styleUrl: './stockpage.component.css'
})
export class StockpageComponent implements OnInit{
  stock: any = {
    product: {
      id: null,
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

  selectedStock: any = {
    product: null,
    available: null,
    status: null,
    creationDate: null,
  }

  // ↓ NOUVEAUX pour le dialog création
  dialogCreateVisible: boolean = false;
  newLockerNumber: number | null = null;
  selectedProductForCreate: any = null;

  countCheck: number = 0;
  countHistory: number = 0;


  dialog1Visible: boolean = false;
  dialog2Visible: boolean = false;

  responsiveOptions: any[] | undefined;

  listOfProducts: any[] = [];


  constructor(protected stockService: StockService, private messageService: MessageService, protected productService: ProductService, protected checkService: CheckService, protected historyService: HistoryService) {}

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

    //get product service to get all products
    this.listOfProducts = this.productService.getAllProducts();
    this.stockService.refreshStocks();
  }

  // ↓ NOUVELLE méthode : ouvre le dialog création
  openCreateDialog() {
    if (!this.stock.product || !this.stock.product.id) {
      return;
    }
    this.selectedProductForCreate = this.productService.getAllProducts()
      .find((p: any) => p.id == this.stock.product.id);

    this.newLockerNumber = null;
    this.dialogCreateVisible = true;
  }

  createStock() {
    // 1. Validation de base sur la plage
    if (this.newLockerNumber == null || this.newLockerNumber < 1 || this.newLockerNumber > 27) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Le numéro de casier doit être compris entre 1 et 27'
      });
      return;
    }

    // 2. Vérifier si le casier est déjà utilisé
    const allStocks = this.stockService.getAllStocks();
    const lockerAlreadyUsed = allStocks.some(
      (s: any) => s.lockerNumber === this.newLockerNumber
    );

    if (lockerAlreadyUsed) {
      this.messageService.add({
        severity: 'error',
        summary: 'Casier déjà utilisé',
        detail: `Le casier ${this.newLockerNumber} est déjà affecté à un autre stock`
      });
      return;
    }

    // 3. Création du stock si tout est OK
    const stockToSend = {
      product: this.selectedProductForCreate,
      available: true,
      status: 1,
      creationDate: new Date()
    };

    this.stockService.addStock(stockToSend, this.newLockerNumber);
    this.dialogCreateVisible = false;
    this.showAddToast();

    // Reset du select
    this.stock.product.id = null;
  }



  triggerDeleteStock() {
    this.checkService.getCheckByStockId(this.selectedStock.id).then((response: any) => {
      console.log(response);
      this.countCheck = response;
    });
    this.historyService.getHistoryByStockId(this.selectedStock.id).then((response: any) => {
      console.log(response);
      this.countHistory = response;
    })
  }

  convertToString(stock_id: number): string {
    return stock_id.toString();
  }


  showDialog(stock: any, dialogNumber: number) {
    if(dialogNumber === 1){
      this.dialog1Visible = true;
    } else {
      this.dialog2Visible = true;
    }
    // copy the stock to selectedStock
    this.selectedStock = {...stock};
  }

  hideDialog() {
    this.dialog1Visible = false;
    this.dialog2Visible = false;
  }

  showAddToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un stock a été ajouté' });
  }

  showUpdateToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un stock a été modifié' });
  }

  showDeleteToast(){
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un stock a été supprimé' });
  }

  protected readonly faBoxesStacked = faBoxesStacked;
}
