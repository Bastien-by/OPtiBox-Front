import { Component } from '@angular/core';
import {ProductService} from "../../services/product.service";
import {LightComponent} from "../light/light.component";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {ProductComponent} from "../product/product.component";

@Component({
  selector: 'app-productpage',
  standalone: true,
  imports: [
    LightComponent,
    NgForOf,
    ReactiveFormsModule,
    FormsModule,
    ProductComponent
  ],
  templateUrl: './productpage.component.html',
  styleUrl: './productpage.component.css'
})
export class ProductpageComponent {
  product: any = {
    title: '',
    type: '',
    size: '',
    cmu: '',
    location: '',
    picture: '',
  }

  constructor(protected productService: ProductService) {}

  handleTrigger(id: number){
    this.productService.removeProduct(id);
  }

}
