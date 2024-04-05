import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [],
  templateUrl: './product.component.html',
  styleUrl: './product.component.css'
})
export class ProductComponent {

  @Input('productInput')
  product: any = {
    title: 'UNKNOWN',
    type: 'UNKNOWN',
    size: 'UNKNOWN',
    cmu: 'UNKNOWN',
    location: 'UNKNOWN',
    picture: 'UNKNOWN',
  }

  @Output("trigger")
  trigger: EventEmitter<any> = new EventEmitter<any>();
  launchTrigger(){
    this.trigger.emit();
  }

}
