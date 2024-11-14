import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class ScanService {

  private availableStocksArray: any[] = [];
  private loanedStocksArray: any[] = [];
  private usersArray: any[] = [];
  private history: any = {};

  constructor(private httpClient: HttpClient) {
    this.refreshAvailableStocks();
    this.refreshLoanedStocks();
    this.refreshUsers();
  }



  refreshData() {
    return Promise.all([
      this.refreshAvailableStocks(),
      this.refreshLoanedStocks(),
      this.refreshUsers()
    ]);
  }

  refreshAvailableStocks(){
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/stocks/getAvailableStocks').subscribe(
        (stocks: any) => {
          this.availableStocksArray = stocks;
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  refreshLoanedStocks(){
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/stocks/getUnavailableStocks').subscribe(
        (stocks: any) => {
          this.loanedStocksArray = stocks;
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  refreshUsers(){
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/users').subscribe(
        (users: any) => {
          this.usersArray = users;
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  getAvailableStocks() {
    return this.availableStocksArray;
  }

  getLoanedStocks() {
    return this.loanedStocksArray;
  }

  getUsers() {
    return this.usersArray;
  }


  async createHistory(history: any){
    this.httpClient.post('api/history', history).subscribe(() => {
    })
  }

}
