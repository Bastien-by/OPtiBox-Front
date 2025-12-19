import {CanActivate, Routes} from '@angular/router';
import {RacinePageComponent} from "./component/racine-page/racine-page.component";
import {ProductpageComponent} from "./component/productpage/productpage.component";
import {StockpageComponent} from "./component/stockpage/stockpage.component";
import {UserpageComponent} from "./component/userpage/userpage.component";
import {ScanpageComponent} from "./component/scanpage/scanpage.component";
import {HistorypageComponent} from "./component/historypage/historypage.component";
import {ProcedurepageComponent} from "./component/procedurepage/procedurepage.component";
import {CheckpageComponent} from "./component/checkpage/checkpage.component";
import {OpenLockerComponent} from "./component/openlockerpage/openlocker.component";
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: "", component: RacinePageComponent
  },
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
    path: "procedure", component: ProcedurepageComponent
  },
  {
    path: 'open-locker', component: OpenLockerComponent
  },
  {
    path: "product", component: ProductpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: "stock", component: StockpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: "user", component: UserpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: "**", redirectTo: ""
  },
  {
    path: "racine", component: RacinePageComponent
  },
];
