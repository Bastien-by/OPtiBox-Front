import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.css'
})
export class ProductComponent {

  @Input('stockInput')
  stock: any = {
    product: null,
    available: null,
    status: null,
    creationDate: null,
  }

  @Output("trigger")
  trigger: EventEmitter<any> = new EventEmitter<any>();
  launchTrigger(){
    this.trigger.emit();
  }

}
