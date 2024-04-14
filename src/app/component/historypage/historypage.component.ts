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
  constructor(protected historyService: HistoryService) {}

  ngOnInit(){
    this.historyService.refreshHistory();
  }
}
