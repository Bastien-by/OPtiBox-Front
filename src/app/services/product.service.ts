import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import { map, Observable, forkJoin, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  private productArray: any[] = [];
  constructor(private httpClient: HttpClient) {
    this.refreshProducts();
  }

  refreshProducts(){
    this.httpClient.get('api/products').subscribe((products: any) => {
      this.productArray = products;
    })
  }
  getAllProducts() {
    return this.productArray;
  }

  addProduct(productSent: any) {
    console.log('Sending product:', productSent);  // Log des données envoyées
    console.log('Brand:', productSent.brand);
    const formData = new FormData();
    formData.append('title', productSent.title);
    formData.append('size', productSent.size);
    formData.append('cmu', productSent.cmu);
    formData.append('location', productSent.location);
    formData.append('brand', productSent.brand);
    formData.append('picture', productSent.picture); // Base64 de l'image
    this.httpClient.post('api/products', formData).subscribe(() => {
      this.refreshProducts();
    });
  }

  updateProduct(productSent: any){
    const formData = new FormData();
    formData.append('id', productSent.id);
    formData.append('title', productSent.title);
    formData.append('size', productSent.size);
    formData.append('cmu', productSent.cmu);
    formData.append('location', productSent.location);
    formData.append('brand', productSent.brand);
    formData.append('picture', productSent.picture); // Base64 de l'image
    this.httpClient.put('api/products', formData).subscribe((productReceived: any) => {
      this.productArray = this.productArray.map(p => {
        if(p.id === productReceived.id){
          return productReceived;
        }
        return p;
      });
    });

  }


  removeChecksAndHistories(productId: number): void {
    forkJoin({
      checks: this.getCheckIdByProductId(productId),
      histories: this.getHistoryIdByProductId(productId)
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


  removeStock(id: number): void {
    this.getStockIdByProductId(id).subscribe(stocks => {
      if (stocks.length === 0) {
        // Si aucun stock n'est associé, supprimer directement le produit
        this.removeProduct(id);
      } else {
        console.log('ID des stocks associés au produit:', stocks.map(stock => stock.id));
        // Sinon, supprimer les stocks associés avant de supprimer le produit
        const deleteRequests = stocks.map(stock => this.httpClient.delete(`api/stocks/${stock.id}`));

        forkJoin(deleteRequests).subscribe({
          next: () => {
            this.removeProduct(id);
          },
          error: (err) => {
            console.error('Erreur lors de la suppression des stocks :', err);
          }
        });
      }
    });
  }

  removeProduct(id: number): void {
    this.productArray = this.productArray.filter(product => product.id !== id);
    this.httpClient.delete(`api/products/${id}`).subscribe(() => {
      this.refreshProducts();
    }, error => {
      console.error('Erreur lors de la suppression du produit :', error);
    });
  }



  getStockIdByProductId(productId: number): Observable<any[]> {
    return this.httpClient.get<any[]>("api/stocks").pipe(
      map((stocks: any[]) => stocks.filter(stock => stock.product.id === productId))
    );
  }

  getCheckIdByProductId(productId: number): Observable<any[]> {
    return this.getStockIdByProductId(productId).pipe(  // Appel de la méthode pour obtenir les stocks associés au produit
      switchMap(stocks => {
        const stockIds = stocks.map(stock => stock.id);  // Récupération des IDs des stocks associés au produit
        return this.httpClient.get<any[]>('api/checks').pipe(
          map((checks: any[]) => checks.filter(check => stockIds.includes(check.stock.id)))  // Filtre les checks où stock.id est dans stockIds
        );
      })
    );
  }

  getHistoryIdByProductId(productId: number): Observable<any[]> {
    return this.getStockIdByProductId(productId).pipe(  // Appel pour obtenir les stocks associés au produit
      switchMap(stocks => {
        const stockIds = stocks.map(stock => stock.id);  // Extraction des IDs des stocks
        return this.httpClient.get<any[]>('api/history').pipe(  // Appel à l'API des histories
          map((histories: any[]) => histories.filter(history => stockIds.includes(history.stock.id)))  // Filtrage des histories en fonction des IDs de stock
        );
      })
    );
  }



  /*getStockByProductId(id: number) {
    return this.httpClient.get<number[]>('/api/stocks/{id}')
  }*/
}
