import {Component, OnInit} from '@angular/core';
import {HistoryService} from "../../services/history.service";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {MessageService} from "primeng/api";
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-historypage',
  standalone: true,
  imports: [
    NgForOf,
    ReactiveFormsModule,
    FormsModule,
    CarouselModule,
    TagModule,
  ],
  templateUrl: './historypage.component.html',
  providers: [MessageService],
  styleUrl: './historypage.component.css'
})
export class HistorypageComponent implements OnInit{
  history: any = {
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

  responsiveOptions: any[] | undefined;

  constructor(protected historyService: HistoryService, private messageService: MessageService, protected productService: ProductService) {}

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
    this.historyService.refreshHistory();
  }
}
