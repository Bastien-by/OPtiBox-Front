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

  addProduct(productSent: any){
    let product = {
      title: productSent.title,
      type: productSent.type,
      size: productSent.size,
      cmu: productSent.cmu,
      location: productSent.location,
      picture: productSent.picture,
    };
    this.httpClient.post('api/products', product).subscribe(() => {
      this.refreshProducts();
    });
  }

  removeProduct(id: number){
    this.productArray = this.productArray.filter(product => product.id !== id);
    this.httpClient.delete('api/products/' + id).subscribe(() => {
      this.refreshProducts();
    });

  }
}
