import {Component, OnInit} from '@angular/core';
import {HistoryService} from "../../services/history.service";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {MessageService} from "primeng/api";
import {faArrowRightFromBracket, faArrowRightToBracket, faListCheck} from "@fortawesome/free-solid-svg-icons";
import {FaIconComponent} from "@fortawesome/angular-fontawesome";

@Component({
  selector: 'app-historypage',
  standalone: true,
  imports: [
    NgForOf,
    ReactiveFormsModule,
    FormsModule,
    CarouselModule,
    TagModule,
    FaIconComponent,
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

  tab = "withdraw";
  currentPage = 1;
  itemsPerPage = 10;

  constructor(protected historyService: HistoryService) {}

  ngOnInit(){
    this.historyService.refreshHistory();
  }

  setType(type: string){
    this.tab = type;
    this.currentPage = 1;
  }

  getPaginatedHistory(data: any[]) {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return data.slice(startIndex, startIndex + this.itemsPerPage);
  }

  nextPage(totalItems: number) {
    if (this.currentPage * this.itemsPerPage < totalItems) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  protected readonly faArrowRightFromBracket = faArrowRightFromBracket;
  protected readonly faArrowRightToBracket = faArrowRightToBracket;
  protected readonly faListCheck = faListCheck;
}
