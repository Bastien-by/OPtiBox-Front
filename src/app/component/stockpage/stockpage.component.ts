import { Component, OnInit } from '@angular/core';
import { StockService } from '../../services/stock.service';
import { NgForOf, NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CarouselModule } from 'primeng/carousel';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProductService } from '../../services/product.service';
import { faBoxesStacked } from '@fortawesome/free-solid-svg-icons';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { CheckService } from '../../services/check.service';
import { HistoryService } from '../../services/history.service';
import { AuthAppService } from '../../services/auth-app.service';
import { QRCodeModule } from 'angularx-qrcode';

@Component({
  selector: 'app-stockpage',
  standalone: true,
  imports: [
    NgForOf, NgIf,
    ReactiveFormsModule, FormsModule,
    CarouselModule, TagModule, ButtonModule, DialogModule, ToastModule,
    FaIconComponent, QRCodeModule,
  ],
  templateUrl: './stockpage.component.html',
  providers: [MessageService],
  styleUrl: './stockpage.component.css'
})
export class StockpageComponent implements OnInit {

  stock: any = {
    product: { id: null, title: '', size: '', cmu: '', location: '', picture: '' },
    available: null,
    status: null,
    creationDate: null,
  };

  selectedStock: any = {
    product: null, available: null, status: null, creationDate: null,
  };

  // ── Création stock ──────────────────────────────────────────────────────────

  dialogCreateVisible = false;
  selectedProductForCreate: any = null;
  newLockerNumber: number | null = null;
  reference = '';

  /**
   * Liste des alitracers saisis dans le dialog de création.
   * Démarre avec un champ vide.
   * Sauvegardé en base sous la forme "ALI001|ALI002" (séparateur pipe).
   */
  alitracerInputs: string[] = [''];

  // ── Modification stock ─────────────────────────────────────────────────────

  dialog1Visible = false;
  dialog2Visible = false;

  /**
   * Alitracers sous forme de liste pour l'édition (split du champ alitracer).
   */
  editAlitracerInputs: string[] = [''];

  countCheck   = 0;
  countHistory = 0;

  responsiveOptions: any[] | undefined;
  listOfProducts: any[] = [];

  constructor(
    protected stockService: StockService,
    private messageService: MessageService,
    protected productService: ProductService,
    protected checkService: CheckService,
    protected historyService: HistoryService,
    private authApp: AuthAppService
  ) {}

  ngOnInit() {
    this.responsiveOptions = [
      { breakpoint: '1400px', numVisible: 3, numScroll: 3 },
      { breakpoint: '1220px', numVisible: 2, numScroll: 2 },
      { breakpoint: '1100px', numVisible: 1, numScroll: 1 },
    ];
    this.listOfProducts = this.productService.getAllProducts();
    this.stockService.refreshStocks();
  }

  isLoggedIn()    { return this.authApp.isLoggedIn(); }
  isAdmin()       { return this.authApp.isAdmin(); }
  isMaintenance() { return this.authApp.isMaintenance(); }
  isOperator()    { return this.authApp.isOperator(); }

  // ── Helpers alitracers ─────────────────────────────────────────────────────

  /**
   * Retourne les alitracers d'un stock sous forme de tableau.
   * "ALI001|ALI002" → ["ALI001", "ALI002"]
   * "ALI001"        → ["ALI001"]
   */
  getAlitracerList(stock: any): string[] {
    if (!stock?.alitracer) return [];
    return stock.alitracer.split('|').map((a: string) => a.trim()).filter((a: string) => a !== '');
  }

  /** Joint la liste en String pour la sauvegarde. */
  private joinAlitracers(inputs: string[]): string {
    return inputs.map(a => a.trim()).filter(a => a !== '').join('|');
  }

  // ── Dialog CRÉATION ────────────────────────────────────────────────────────

  openCreateDialog() {
    if (!this.stock.product?.id) return;

    this.selectedProductForCreate = this.productService.getAllProducts()
      .find((p: any) => p.id == this.stock.product.id);

    this.newLockerNumber   = null;
    this.alitracerInputs   = [''];   // commence avec 1 champ
    this.reference         = '';
    this.dialogCreateVisible = true;
  }

  addAlitracerField() {
    this.alitracerInputs.push('');
  }

  removeAlitracerField(index: number) {
    if (this.alitracerInputs.length > 1) {
      this.alitracerInputs.splice(index, 1);
    }
  }

  createStock() {
    if (!this.newLockerNumber || this.newLockerNumber < 1 || this.newLockerNumber > 24) {
      this.messageService.add({
        severity: 'error', summary: 'Erreur',
        detail: 'Le numéro de casier doit être compris entre 1 et 24.'
      });
      return;
    }

    const alitracer = this.joinAlitracers(this.alitracerInputs);
    if (!alitracer) {
      this.messageService.add({
        severity: 'error', summary: 'Erreur',
        detail: 'Veuillez saisir au moins un alitracer.'
      });
      return;
    }

    const stockToSend = {
      product:      this.selectedProductForCreate,
      alitracer,      // "ALI001" ou "ALI001|ALI002"
      reference:    this.reference,
      available:    true,
      status:       1,
      creationDate: new Date()
    };

    this.stockService.addStock(stockToSend, this.newLockerNumber);
    this.dialogCreateVisible = false;
    this.showAddToast();
    this.stock.product.id = null;
  }

  // ── Dialog MODIFICATION ────────────────────────────────────────────────────

  showDialog(stock: any, dialogNumber: number) {
    if (dialogNumber === 1) {
      this.dialog1Visible = true;
      // Convertit le champ alitracer en liste pour l'édition
      this.editAlitracerInputs = this.getAlitracerList(stock);
      if (this.editAlitracerInputs.length === 0) this.editAlitracerInputs = [''];
    } else {
      this.dialog2Visible = true;
    }
    this.selectedStock = { ...stock };
  }

  addEditAlitracerField() {
    this.editAlitracerInputs.push('');
  }

  removeEditAlitracerField(index: number) {
    if (this.editAlitracerInputs.length > 1) {
      this.editAlitracerInputs.splice(index, 1);
    }
  }

  saveEditStock() {
    const alitracer = this.joinAlitracers(this.editAlitracerInputs);
    if (!alitracer) {
      this.messageService.add({
        severity: 'error', summary: 'Erreur',
        detail: 'Veuillez saisir au moins un alitracer.'
      });
      return;
    }
    this.selectedStock.alitracer = alitracer;
    this.stockService.updateStock(this.selectedStock);
    this.hideDialog();
    this.showUpdateToast();
  }

  hideDialog() {
    this.dialog1Visible = false;
    this.dialog2Visible = false;
  }

  // ── Suppression ────────────────────────────────────────────────────────────

  triggerDeleteStock() {
    this.checkService.getCheckByStockId(this.selectedStock.id).then((response: any) => {
      this.countCheck = response;
    });
    this.historyService.getHistoryByStockId(this.selectedStock.id).then((response: any) => {
      this.countHistory = response;
    });
  }

  convertToString(stock_id: number): string {
    return stock_id.toString();
  }

  // ── Toasts ─────────────────────────────────────────────────────────────────

  showAddToast()    { this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Un stock a été ajouté.' }); }
  showUpdateToast() { this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Un stock a été modifié.' }); }
  showDeleteToast() { this.messageService.add({ severity: 'success', summary: 'Succès', detail: 'Un stock a été supprimé.' }); }

  /** Nécessaire pour que ngFor sur les tableaux primitifs fonctionne avec [(ngModel)] */
  trackByIndex(index: number): number {
    return index;
  }

  protected readonly faBoxesStacked = faBoxesStacked;
}
