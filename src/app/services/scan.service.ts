import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import { firstValueFrom } from 'rxjs';

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

  // ↓ NOUVELLE méthode pour ouvrir un casier
  async openLocker(lockerNumber: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.httpClient.post(`api/locker/open/${lockerNumber}`, {})
      );
    } catch (error) {
      console.error('Erreur ouverture casier:', error);
      throw error;
    }
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


  async createHistory(history: any): Promise<void> {
    await firstValueFrom(this.httpClient.post('api/history', history));
  }


}


