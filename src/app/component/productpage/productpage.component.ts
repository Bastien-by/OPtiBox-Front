import {Component, OnInit} from '@angular/core';
import {ProductService} from "../../services/product.service";
import {NgForOf} from "@angular/common";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {CarouselModule} from "primeng/carousel";
import {TagModule} from "primeng/tag";
import {ButtonModule} from "primeng/button";
import {DialogModule} from "primeng/dialog";
import {ToastModule} from "primeng/toast";
import {MessageService} from "primeng/api";

@Component({
  selector: 'app-productpage',
  standalone: true,
  imports: [
    NgForOf,
    ReactiveFormsModule,
    FormsModule,
    CarouselModule,
    TagModule,
    ButtonModule,
    DialogModule,
    ToastModule
  ],
  templateUrl: './productpage.component.html',
  providers: [MessageService],
  styleUrl: './productpage.component.css'
})
export class ProductpageComponent implements OnInit {
  product: any = {
    title: '',
    type: '',
    size: '',
    cmu: '',
    location: '',
    picture: null,
  }

  selectedProduct: any = {
    title: '',
    type: '',
    size: '',
    cmu: '',
    location: '',
    picture: '',
  }

  dialog1Visible: boolean = false;
  dialog2Visible: boolean = false;

  responsiveOptions: any[] | undefined;

  constructor(protected productService: ProductService, private messageService: MessageService) {}

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

  onFileSelected(event: any, productToUpdate: any) {
    const file: File = event.target.files[0];

    // check if the file is an image and is less than 20MB
    if(file.type.split('/')[0] !== 'image' || file.size > 20000000){
      this.showErrorImageToast();
      // clear the input file
      event.target.value = '';
      return;
    }
    this.encodeImageAsBase64(file, productToUpdate);
  }


  encodeImageAsBase64(file: any, productToUpdate: any) {
    const reader = new FileReader();
    reader.onload = () => {
      productToUpdate.picture = reader.result;
    }
    reader.readAsDataURL(file);
  }


  addProduct() {
    // check if the product has a title, type, size, cmu and location
    if(this.product.title === '' || this.product.type === '' || this.product.size === '' || this.product.cmu === '' || this.product.location === ''){
      this.showMissingFieldsToast();
      return;
    }

    this.productService.addProduct(this.product);
    this.showAddToast();

    // reset the product
    this.product = {
      title: '',
      type: '',
      size: '',
      cmu: '',
      location: '',
      picture: null,
    }
  }


  showDialog(product: any, dialogNumber: number) {
    if(dialogNumber === 1){
      this.dialog1Visible = true;
    } else {
      this.dialog2Visible = true;
    }
    // copy the product to selectedProduct
    this.selectedProduct = {...product};
  }

  hideDialog() {
    this.dialog1Visible = false;
    this.dialog2Visible = false;
  }

  handleTrigger(id: number){
    this.productService.removeProduct(id);
  }

  showAddToast(){
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un produit a été ajouté' });
  }

  showUpdateToast(){
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un produit a été modifié' });
  }

  showDeleteToast(){
      this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Un produit a été supprimé' });
  }

  showMissingFieldsToast() {
    this.messageService.add({severity: 'error', summary: 'Error', detail: 'Veuillez remplir tous les champs'});
  }

  showErrorImageToast(){
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Veuillez choisir une image valide (<20MB)' });
  }

}
