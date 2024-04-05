import {Component, EventEmitter, Input, Output} from '@angular/core';
import {NgClass, NgStyle} from "@angular/common";

@Component({
  selector: 'app-light',
  standalone: true,
  imports: [
    NgClass,
    NgStyle
  ],
  templateUrl: './light.component.html',
  styleUrl: './light.component.css'
})
export class LightComponent {

  @Input('lightInput')
  light: any = {
    toggled: false,
    title: 'UNKNOWN'
  }

  @Output("trigger")
  trigger: EventEmitter<any> = new EventEmitter<any>();


  @Output("toggled")
  toggled: EventEmitter<any> = new EventEmitter<any>();

  switchLight() {
    this.toggled.emit();
  }

  launchTrigger(){
    this.trigger.emit();
  }
}
