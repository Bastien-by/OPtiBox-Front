import { Routes } from '@angular/router';
import {LightpageComponent} from "./component/lightpage/lightpage.component";
import {RacinePageComponent} from "./component/racine-page/racine-page.component";

export const routes: Routes = [
  {
    path: "light", component: LightpageComponent
  },
  {
    path: "**", redirectTo: "racine"
  },
  {
    path: "racine", component: RacinePageComponent
  }
];
