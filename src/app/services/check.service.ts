import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {firstValueFrom} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class CheckService {

  private stocksArray: any[] = [];
  private usersArray: any[] = [];
  private checksArray: any[] = [];
  private check: any = {};

  constructor(private httpClient: HttpClient) {
    this.refreshStocks();
    this.refreshUsers();
  }

  // Send the corresponding Color Class representing a status
  getStatusClass(review: any): string {
    switch (review.status) {
      case 0:
        //NOK
        return 'text-orange-400';
      case 1:
        //OK
        return 'text-green-500';
      case 2:
        //HS
        return 'text-red-600';
      default:
        return '';
    }
  }

  refreshData() {
    return Promise.all([
      this.refreshStocks(),
      this.refreshUsers()
    ]);
  }

  refreshStocks(){
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/stocks').subscribe(
        (checks: any) => {
          this.stocksArray = checks;
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

  getStocks() {
    return this.stocksArray;
  }

  getUsers() {
    return this.usersArray;
  }


  async createCheck(check: any){
    console.log(check);
    this.httpClient.post('api/checks', check).subscribe(() => {
    })
  }

  async getChecks() {
    this.checksArray = await firstValueFrom(this.httpClient.get<any>('api/checks'));
    return this.checksArray;
  }

  getLastCheck() {
    // if there are no checks, return an empty object
    if (this.checksArray.length === 0) {
      return {};
    }
    return this.checksArray[this.checksArray.length - 1];
  }

  getCheckByStockId(id: number) {
    return this.httpClient.get('api/checks/getCheckByStockId/' + id).toPromise();
  }

}
