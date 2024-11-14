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
    FaIconComponent
  ],
  templateUrl: './stockpage.component.html',
  providers: [MessageService],
  styleUrl: './stockpage.component.css'
})
export class StockpageComponent implements OnInit{
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

  selectedStock: any = {
    product: null,
    available: null,
    status: null,
    creationDate: null,
  }


  dialog1Visible: boolean = false;
  dialog2Visible: boolean = false;

  responsiveOptions: any[] | undefined;

  listOfProducts: any[] = [];

  constructor(protected stockService: StockService, private messageService: MessageService, protected productService: ProductService) {}

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
