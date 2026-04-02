import { Routes } from '@angular/router';
import { LoginpageComponent } from './component/loginpage/loginpage.component';
import { RacinePageComponent } from './component/racine-page/racine-page.component';
import { ScanpageComponent } from './component/scanpage/scanpage.component';
import { CheckpageComponent } from './component/checkpage/checkpage.component';
import { HistorypageComponent } from './component/historypage/historypage.component';
import { ProcedurePageComponent } from './component/procedurepage/procedurepage.component';
import { ProductpageComponent } from './component/productpage/productpage.component';
import { StockpageComponent } from './component/stockpage/stockpage.component';
import { UserpageComponent } from './component/userpage/userpage.component';
import { AuthGuard } from './auth.guard';
import { DepositpageComponent } from './component/depositpage/depositpage.component';
import { LockerpageComponent } from './component/lockerpage/lockerpage.component';

export const routes: Routes = [
  // Route par défaut → login
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  // Pages publiques (SANS guard)
  { path: 'racine', component: RacinePageComponent },
  { path: 'login',  component: LoginpageComponent  },
  // Pages protégées (AVEC guard)
  { path: 'scanpage',        component: ScanpageComponent,      canActivate: [AuthGuard] },
  { path: 'deposit',         component: DepositpageComponent,   canActivate: [AuthGuard] },
  { path: 'withdraw-deposit',component: ScanpageComponent,      canActivate: [AuthGuard] },
  { path: 'check',           component: CheckpageComponent,     canActivate: [AuthGuard] },
  { path: 'history',         component: HistorypageComponent,   canActivate: [AuthGuard] },
  { path: 'procedures',      component: ProcedurePageComponent, canActivate: [AuthGuard] },
  { path: 'product',         component: ProductpageComponent,   canActivate: [AuthGuard] },
  { path: 'stock',           component: StockpageComponent,     canActivate: [AuthGuard] },
  { path: 'user',            component: UserpageComponent,      canActivate: [AuthGuard] },
  // Page casiers — admin uniquement (guard route + vérification isAdmin() dans le composant)
  { path: 'lockers',         component: LockerpageComponent,    canActivate: [AuthGuard] },
  // Wildcard (404)
  { path: '**', redirectTo: '/racine' }
];
