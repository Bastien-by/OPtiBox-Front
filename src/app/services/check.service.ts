import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class CheckService {

  private stocksArray: any[] = [];
  private usersArray: any[] = [];
  private check: any = {};

  constructor(private httpClient: HttpClient) {
    this.refreshStocks();
    this.refreshUsers();
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

}
