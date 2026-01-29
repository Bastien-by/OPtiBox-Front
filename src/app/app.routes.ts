import { Routes } from '@angular/router';
import { LoginpageComponent } from './component/loginpage/loginpage.component';
import { RacinePageComponent } from './component/racine-page/racine-page.component';
import { ScanpageComponent } from './component/scanpage/scanpage.component';
import { CheckpageComponent } from './component/checkpage/checkpage.component';
import { HistorypageComponent } from './component/historypage/historypage.component';
import { ProcedurepageComponent } from './component/procedurepage/procedurepage.component';
import { ProductpageComponent } from './component/productpage/productpage.component';
import { StockpageComponent } from './component/stockpage/stockpage.component';
import { UserpageComponent } from './component/userpage/userpage.component';
import { AuthGuard } from './auth.guard';

export const routes: Routes = [
  // ✅ Route par défaut → racine (page d'accueil publique)
  { path: '', redirectTo: '/racine', pathMatch: 'full' },

  // ✅ Page racine (accueil, SANS guard)
  { path: 'racine', component: RacinePageComponent },

  // ✅ Page login (SANS guard)
  { path: 'login', component: LoginpageComponent },

  // ✅ Pages protégées (AVEC guard)
  {
    path: 'scanpage',
    component: ScanpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'withdraw-deposit',
    component: ScanpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'check',
    component: CheckpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'history',
    component: HistorypageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'procedure',
    component: ProcedurepageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'product',
    component: ProductpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'stock',
    component: StockpageComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'user',
    component: UserpageComponent,
    canActivate: [AuthGuard]
  },

  // ✅ Wildcard (404) → redirige vers racine
  { path: '**', redirectTo: '/racine' }
];
