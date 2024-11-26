import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";
import { map, Observable, forkJoin } from 'rxjs';

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
    formData.append('type', productSent.type);
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
    formData.append('type', productSent.type);
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

  removeProduct(id: number): void {
    this.getStockIdByProductId(id).subscribe(stocks => {
      if (stocks.length === 0) {
        // Si aucun stock n'est associé, supprimer directement le produit
        this.deleteProduct(id);
      } else {
        // Sinon, supprimer les stocks associés avant de supprimer le produit
        const deleteRequests = stocks.map(stock => this.httpClient.delete(`api/stocks/${stock.id}`));
        
        forkJoin(deleteRequests).subscribe({
          next: () => {
            this.deleteProduct(id);
          },
          error: (err) => {
            console.error('Erreur lors de la suppression des stocks :', err);
          }
        });
      }
    });
  }
  
  deleteProduct(id: number): void {
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

  /*getStockByProductId(id: number) {
    return this.httpClient.get<number[]>('/api/stocks/{id}')
  }*/
}
