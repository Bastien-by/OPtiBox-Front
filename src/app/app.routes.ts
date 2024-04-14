import { Routes } from '@angular/router';
import {RacinePageComponent} from "./component/racine-page/racine-page.component";
import {ProductpageComponent} from "./component/productpage/productpage.component";
import {StockpageComponent} from "./component/stockpage/stockpage.component";
import {UserpageComponent} from "./component/userpage/userpage.component";
import {ScanpageComponent} from "./component/scanpage/scanpage.component";
import {HistorypageComponent} from "./component/historypage/historypage.component";
import {CheckpageComponent} from "./component/checkpage/checkpage.component";

export const routes: Routes = [
  {
    path: "scan", component: ScanpageComponent
  },
  {
    path: "check", component: CheckpageComponent
  },
  {
    path: "history", component: HistorypageComponent
  },
  {
    path: "product", component: ProductpageComponent
  },
  {
    path: "stock", component: StockpageComponent
  },
  {
    path: "user", component: UserpageComponent
  },
  {
    path: "**", redirectTo: "racine"
  },
  {
    path: "racine", component: RacinePageComponent
  }
];
