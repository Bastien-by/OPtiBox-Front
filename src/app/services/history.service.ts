import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private withdrawHistoryArray: any[] = [];
  private depositHistoryArray: any[] = [];
  private checkHistoryArray: any[] = [];
  constructor(private httpClient: HttpClient) {
    this.refreshHistory();
  }

  refreshHistory(){
    this.httpClient.get('api/history/withdraw').subscribe((withdrawHistory: any) => {
      this.withdrawHistoryArray = withdrawHistory;
    })

    this.httpClient.get('api/history/deposit').subscribe((depositHistory: any) => {
      this.depositHistoryArray = depositHistory;
    })

    this.httpClient.get('api/checks').subscribe((checkHistory: any) => {
      this.checkHistoryArray = checkHistory;
    })
  }

  getAllWithdrawHistory() {
    return this.withdrawHistoryArray;
  }

  getAllDepositHistory() {
    return this.depositHistoryArray;
  }

  getAllCheckHistory() {
    return this.checkHistoryArray;
  }
}
