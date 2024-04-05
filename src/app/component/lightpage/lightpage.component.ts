import { Component } from '@angular/core';
import {NgClass, NgForOf} from "@angular/common";
import {LightComponent} from "../light/light.component";
import {LightService} from "../../services/light.service";
import {FormsModule} from "@angular/forms";

@Component({
  selector: 'app-lightpage',
  standalone: true,
  imports: [
    NgClass,
    NgForOf,
    LightComponent,
    FormsModule
  ],
  templateUrl: './lightpage.component.html',
  styleUrl: './lightpage.component.css'
})
export class LightpageComponent {

  light: any = {
    name: "",
    color: "#05b327"
  }

  constructor(protected lightService: LightService) {}

  handleTrigger(id: number){
    this.lightService.removeLight(id);
  }

  switchLight(light: any) {
    console.log("switching : " + light);
    this.lightService.toggleLight(light);
  }
}
