import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, forkJoin, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StockService {

  private stockArray: any[] = [];

  constructor(private httpClient: HttpClient) {
    this.refreshStocks();
  }

  async refreshStocks() {
    this.stockArray = await firstValueFrom(this.httpClient.get<any[]>('api/stocks'));
  }

  getAllStocks() {
    return this.stockArray;
  }

  addStock(stockSent: any, lockerNumber: number | null) {
    const stock = {
      product:      stockSent.product,
      alitracer:    stockSent.alitracer,  // peut être "ALI001" ou "ALI001|ALI002"
      reference:    stockSent.reference,
      available:    true,
      status:       1,
      creationDate: new Date(),
      lockerNumber: lockerNumber ?? null
    };
    this.httpClient.post('api/stocks', stock).subscribe(() => {
      this.refreshStocks();
    });
  }

  updateStock(stockSent: any) {
    const stock = {
      id:           stockSent.id,
      available:    stockSent.available,
      status:       stockSent.status,
      alitracer:    stockSent.alitracer,
      reference:    stockSent.reference,
      lockerNumber: stockSent.lockerNumber
    };

    this.httpClient.post('api/stocks', stock).subscribe((stockReceived: any) => {
      this.stockArray = this.stockArray.map(p =>
        p.id === stockReceived.id ? stockReceived : p
      );
    });
  }

  removeChecksAndHistories(productId: number): void {
    forkJoin({
      checks:    this.getCheckIdByStockId(productId),
      histories: this.getHistoryIdByStockId(productId)
    }).subscribe(({ checks, histories }) => {
      if (checks.length === 0 && histories.length === 0) {
        this.removeStock(productId);
        return;
      }

      const deleteChecksRequests    = checks.map(c => this.httpClient.delete(`api/checks/${c.id}`));
      const deleteHistoriesRequests = histories.map(h => this.httpClient.delete(`api/history/${h.id}`));

      forkJoin([...deleteChecksRequests, ...deleteHistoriesRequests]).subscribe({
        next:  () => this.removeStock(productId),
        error: (err) => console.error('Erreur suppression checks/histories :', err)
      });
    });
  }

  removeStock(id: number) {
    this.stockArray = this.stockArray.filter(stock => stock.id !== id);
    this.httpClient.delete('api/stocks/' + id).subscribe(() => {
      this.refreshStocks();
    });
  }

  getStockById(id: number) {
    return this.stockArray.find(stock => stock.id == id);
  }

  getStockByAlitracer(alitracer: string) {
    return this.stockArray.find(stock => stock.product.alitracer === alitracer);
  }

  getStockByProductId(id: number) {
    return this.httpClient.get('api/stocks/getStockByProductId/' + id).toPromise();
  }

  getStockIdByProductId(productId: number): Observable<any[]> {
    return this.httpClient.get<any[]>('api/stocks').pipe(
      map((stocks: any[]) => stocks.filter(stock => stock.product.id === productId))
    );
  }

  getCheckIdByStockId(stockId: number): Observable<any[]> {
    return this.httpClient.get<any[]>('api/checks/getCheckByStockId/' + stockId);
  }

  getHistoryIdByStockId(stockId: number): Observable<any[]> {
    return this.httpClient.get<any[]>('api/history').pipe(
      map((items: any[]) => items.filter(item => item.stock.id == stockId))
    );
  }

  /**
   * Retourne tous les checks groupés par stock ID en une seule requête.
   * Requiert GET /checks/all-by-stocks côté backend.
   */
  getAllChecksByStocks(): Observable<{ [stockId: number]: any[] }> {
    return this.httpClient.get<{ [stockId: number]: any[] }>('api/checks/all-by-stocks');
  }

  // ── Helpers alitracers ──────────────────────────────────────────────────────

  /**
   * Retourne les alitracers d'un stock sous forme de tableau.
   * "ALI001|ALI002" → ["ALI001", "ALI002"]
   * "ALI001"        → ["ALI001"]
   */
  static getAlitracerList(stock: any): string[] {
    if (!stock?.alitracer) return [];
    return stock.alitracer.split('|').map((a: string) => a.trim()).filter((a: string) => a !== '');
  }

  /**
   * Vérifie si un alitracer scanné correspond à un stock.
   * Gère les alitracers multiples (séparés par |).
   * Utilisé dans scanpage, depositpage et checkpage pour identifier un stock au scan.
   *
   * Exemple :
   *   stock.alitracer = "ALI001|ALI002"
   *   matchesAlitracer(stock, "ALI001") → true
   *   matchesAlitracer(stock, "ALI002") → true
   *   matchesAlitracer(stock, "ALI003") → false
   */
  static matchesAlitracer(stock: any, scannedAlitracer: string): boolean {
    const list = StockService.getAlitracerList(stock);
    return list.some(a => a === scannedAlitracer.trim());
  }

  /**
   * Trouve un stock dans une liste à partir d'un alitracer scanné.
   * Gère les alitracers multiples.
   */
  static findByAlitracer(stocks: any[], scannedAlitracer: string): any | undefined {
    return stocks.find(s => StockService.matchesAlitracer(s, scannedAlitracer));
  }
}
