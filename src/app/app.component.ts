import {Component, OnInit} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavbarComponent} from "./component/navbar/navbar.component";
import {LightpageComponent} from "./component/lightpage/lightpage.component";
import {HttpClient} from "@angular/common/http";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, LightpageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit{
  title = 'devwebtd';

  constructor(private httpClient: HttpClient) {
  }

  ngOnInit() {
    this.httpClient.get('api/lights').subscribe((lights => {
      console.log(lights);
    }))
  }
}
