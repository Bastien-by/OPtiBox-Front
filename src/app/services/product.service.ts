import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";

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

  removeProduct(id: number){
    this.productArray = this.productArray.filter(product => product.id !== id);
    this.httpClient.delete('api/products/' + id).subscribe(() => {
      this.refreshProducts();
    });

  }
}
