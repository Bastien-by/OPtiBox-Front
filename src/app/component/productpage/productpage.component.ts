import { Component } from '@angular/core';
import {ProductService} from "../../services/product.service";
import {LightComponent} from "../light/light.component";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {ProductComponent} from "../product/product.component";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {ButtonModule} from "primeng/button";
import {DialogModule} from "primeng/dialog";

@Component({
  selector: 'app-productpage',
  standalone: true,
  imports: [
    LightComponent,
    NgForOf,
    ReactiveFormsModule,
    FormsModule,
    ProductComponent,
    CarouselModule,
    TagModule,
    ButtonModule,
    DialogModule
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

  selectedProduct: any = {
    title: '',
    type: '',
    size: '',
    cmu: '',
    location: '',
    picture: '',
  }

  visible: boolean = false;

  responsiveOptions: any[] | undefined;

  constructor(protected productService: ProductService) {}

  ngOnInit(){
    this.responsiveOptions = [
      {
        breakpoint: '1400px',
        numVisible: 3,
        numScroll: 3
      },
      {
        breakpoint: '1220px',
        numVisible: 2,
        numScroll: 2
      },
      {
        breakpoint: '1100px',
        numVisible: 1,
        numScroll: 1
      }
    ];
  }


  showDialog(product: any) {
    this.visible = true;
    // copy the product to selectedProduct
    this.selectedProduct = {...product};
  }

  hideDialog() {
    this.visible = false;
  }

  handleTrigger(id: number){
    this.productService.removeProduct(id);
  }

}
