import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import {firstValueFrom, forkJoin, map, Observable, switchMap} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class StockService {

  private stockArray: any[] = [];
  constructor(private httpClient: HttpClient) {
    this.refreshStocks();
  }

  async refreshStocks(){
    this.stockArray = await firstValueFrom(this.httpClient.get<any>('api/stocks'));
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

  /**/

  removeChecksAndHistories(productId: number): void {
    forkJoin({
      checks: this.getCheckIdByStockId(productId),
      histories: this.getHistoryIdByStockId(productId)
    }).subscribe(({ checks, histories }) => {
      const hasChecks = checks.length > 0;
      const hasHistories = histories.length > 0;
  
      if (!hasChecks && !hasHistories) {
        // Aucun check ni history associé, suppression directe du stock
        this.removeStock(productId);
      } else {
        console.log('ID des checks associés:', checks.map(check => check.id));
        console.log('ID des histories associés:', histories.map(history => history.id));
  
        // Suppression des checks et histories
        const deleteChecksRequests = checks.map(check => this.httpClient.delete(`api/checks/${check.id}`));
        const deleteHistoriesRequests = histories.map(history => this.httpClient.delete(`api/history/${history.id}`));
        
        forkJoin([...deleteChecksRequests, ...deleteHistoriesRequests]).subscribe({
          next: () => {
            this.removeStock(productId);
          },
          error: (err) => {
            console.error('Erreur lors de la suppression des Checks ou Histories :', err);
          }
        });
      }
    });
  }

  removeStock(id: number){
    this.stockArray = this.stockArray.filter(stock => stock.id !== id);
    this.httpClient.delete('api/stocks/' + id).subscribe(() => {
      this.refreshStocks();
    });

  }

  getStockById(id: number){
    return this.stockArray.find(stock => stock.id == id);
  }

  getStockByProductId(id: number) {
    return this.httpClient.get('api/stocks/getStockByProductId/' + id).toPromise();
  }
  getStockIdByProductId(productId: number): Observable<any[]> {
    return this.httpClient.get<any[]>("api/stocks").pipe(
      map((stocks: any[]) => stocks.filter(stock => stock.product.id === productId))
    );
  }

  getCheckIdByStockId(stockId: number): Observable<any[]> {
    return this.httpClient.get<any[]>("api/checks").pipe(
      map((checks: any[]) => checks.filter(check => check.stock.id == stockId))
    );
  }

  getHistoryIdByStockId(stockId: number): Observable<any[]> {
    return this.httpClient.get<any[]>("api/history").pipe(
      map((checks: any[]) => checks.filter(check => check.stock.id == stockId))
    );
  }

  
}
