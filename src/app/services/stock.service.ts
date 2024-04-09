import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class StockService {

  private stockArray: any[] = [];
  constructor(private httpClient: HttpClient) {
    this.refreshStocks();
  }

  refreshStocks(){
    this.httpClient.get('api/stocks').subscribe((stocks: any) => {
      this.stockArray = stocks;
    })
  }
  getAllStocks() {
    return this.stockArray;
  }

  addStock(stockSent: any){
    let stock = {
      product: stockSent.product,
      available: true,
      status: 1,
      creationDate: new Date(),
    };
    this.httpClient.post('api/stocks', stock).subscribe(() => {
      this.refreshStocks();
    });
  }

  updateStock(stockSent: any){
    let stock = {
      id: stockSent.id,
      available: stockSent.available,
      status: stockSent.status,
    };
    this.httpClient.post('api/stocks', stock).subscribe((stockReceived: any) => {
      this.stockArray = this.stockArray.map(p => {
        if(p.id === stockReceived.id){
          return stockReceived;
        }
        return p;
      });
    });

  }

  removeStock(id: number){
    this.stockArray = this.stockArray.filter(stock => stock.id !== id);
    this.httpClient.delete('api/stocks/' + id).subscribe(() => {
      this.refreshStocks();
    });

  }
}
