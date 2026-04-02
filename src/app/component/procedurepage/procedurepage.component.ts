import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faClipboardList } from '@fortawesome/free-solid-svg-icons';
import { ProcedureService } from '../../services/procedure.service';
import { AuthAppService } from '../../services/auth-app.service';

@Component({
  selector: 'app-procedurepage',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ToastModule,
    FaIconComponent
  ],
  templateUrl: './procedurepage.component.html',
  providers: [MessageService],
  styleUrl: './procedurepage.component.css'
})
export class ProcedurePageComponent implements OnInit {

  procedure: any = {
    title: '',
    subtitle: '',
    steps: [],
    questions: [],
    picture: null,
  };

  selectedProcedure: any = {
    id: null,
    title: '',
    subtitle: '',
    steps: [],
    questions: [],
    picture: null,
  };

  dialog1Visible = false;
  dialog2Visible = false;
  dialogCreateVisible = false;

  protected readonly faClipboardList = faClipboardList;

  constructor(
    protected procedureService: ProcedureService,
    private messageService: MessageService,
    private authApp: AuthAppService
  ) {}

  ngOnInit(): void {
    this.procedureService.refreshProcedures();
  }

  isLoggedIn(): boolean {
    return this.authApp.isLoggedIn();
  }

  isAdmin(): boolean {
    return this.authApp.isAdmin();
  }

  onFileSelected(event: any, target: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    if (file.type.split('/')[0] !== 'image' || file.size > 20000000) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez choisir une image valide (<20MB)'
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      target.picture = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  addStep(target: any) {
    target.steps = [...(target.steps ?? []), ''];
  }

  removeStep(target: any, index: number) {
    target.steps = target.steps.filter((_: any, i: number) => i !== index);
  }

  updateStep(target: any, index: number, value: string) {
    const steps = [...target.steps];
    steps[index] = value;
    target.steps = steps;
  }

  addQuestion(target: any) {
    target.questions = [...(target.questions ?? []), ''];
  }

  removeQuestion(target: any, index: number) {
    target.questions = target.questions.filter((_: any, i: number) => i !== index);
  }

  updateQuestion(target: any, index: number, value: string) {
    const questions = [...target.questions];
    questions[index] = value;
    target.questions = questions;
  }

  showCreateDialog() {
    this.procedure = {
      title: '',
      subtitle: '',
      steps: [],
      questions: [],
      picture: null,
    };
    this.dialogCreateVisible = true;
  }

  showDialog(proc: any, dialogNumber: number) {
    this.selectedProcedure = {
      ...proc,
      steps: [...(proc.steps ?? [])],
      questions: [...(proc.questions ?? [])]
    };

    if (dialogNumber === 1) {
      this.dialog1Visible = true;
    } else {
      this.dialog2Visible = true;
    }
  }

  hideDialog() {
    this.dialog1Visible = false;
    this.dialog2Visible = false;
    this.dialogCreateVisible = false;
  }

  addProcedure() {
    if (
      this.procedure.title.trim().length === 0
    ) {
      this.showMissingFieldsToast();
      return;
    }

    this.procedureService.addProcedure(this.procedure);
    this.showAddToast();

    this.procedure = {
      title: '',
      subtitle: '',
      steps: [],
      questions: [],
      picture: null,
    };

    this.hideDialog();
  }

  updateProcedure() {
    if (
      this.selectedProcedure.title.trim().length === 0 ||
      this.selectedProcedure.category.trim().length === 0
    ) {
      this.showMissingFieldsToast();
      return;
    }

    this.procedureService.updateProcedure(this.selectedProcedure);
    this.showUpdateToast();
    this.hideDialog();
  }

  triggerDeleteProcedure() {
    // no-op si tu n’as pas besoin d’un compteur
  }

  deleteProcedure() {
    this.procedureService.removeProcedure(this.selectedProcedure.id);
    this.showDeleteToast();
    this.hideDialog();
  }

  showAddToast() {
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Une procédure a été ajoutée' });
  }

  showUpdateToast() {
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Une procédure a été modifiée' });
  }

  showDeleteToast() {
    this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Une procédure a été supprimée' });
  }

  showMissingFieldsToast() {
    this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Veuillez remplir tous les champs obligatoires' });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  }

  trackByIndex(index: number): number {
    return index;
  }
}
