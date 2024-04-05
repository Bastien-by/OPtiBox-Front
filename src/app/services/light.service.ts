import { Injectable } from '@angular/core';
import {HttpClient} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class LightService {
  private lightArray: any[] = [];

  constructor(private httpClient: HttpClient) {
    this.refreshLights();
  }

  refreshLights(){
    this.httpClient.get('api/lights').subscribe((lights: any) => {
      this.lightArray = lights;
    })
  }
  getAllLights() {
    return this.lightArray;
  }

  addLight(lightSent: any){
    let light = {
      toggled: false,
      title: lightSent.name,
      color: lightSent.color
    };
    this.httpClient.post('api/lights', light).subscribe(() => {
      this.refreshLights();
    });
  }

  removeLight(id: number){
    this.lightArray = this.lightArray.filter(light => light.id !== id);
    this.httpClient.delete('api/lights/' + id).subscribe(() => {
      this.refreshLights();
    });

  }

  toggleLight(light: any) {
    light.toggled = !light.toggled;
    this.httpClient.post("/api/lights", light).subscribe((lightReceived: any) => {
      light = lightReceived;
    });
  }
}
