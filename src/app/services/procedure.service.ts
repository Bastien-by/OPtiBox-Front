import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class ProcedureService {

  private procedureArray: any[] = [];

  constructor(private httpClient: HttpClient) {
    this.refreshProcedures();
  }

  refreshProcedures() {
    this.httpClient.get('api/procedures').subscribe((procedures: any) => {
      this.procedureArray = (procedures as any[]).map(p => ({
        ...p,
        steps: this.parseJson(p.steps),
        questions: this.parseJson(p.questions)
      }));
    });
  }

  getAllProcedures() {
    return this.procedureArray;
  }

  addProcedure(procedureSent: any) {
    const formData = new FormData();
    formData.append('title', procedureSent.title ?? '');
    formData.append('subtitle', procedureSent.subtitle ?? '');
    formData.append('steps', JSON.stringify(procedureSent.steps ?? []));
    formData.append('questions', JSON.stringify(procedureSent.questions ?? []));

    if (procedureSent.picture) {
      formData.append('picture', procedureSent.picture);
    }

    this.httpClient.post('api/procedures', formData).subscribe(() => {
      this.refreshProcedures();
    });
  }

  updateProcedure(procedureSent: any) {
    const formData = new FormData();
    formData.append('id', procedureSent.id);
    formData.append('title', procedureSent.title ?? '');
    formData.append('subtitle', procedureSent.subtitle ?? '');
    formData.append('steps', JSON.stringify(procedureSent.steps ?? []));
    formData.append('questions', JSON.stringify(procedureSent.questions ?? []));

    if (procedureSent.picture) {
      formData.append('picture', procedureSent.picture);
    }

    this.httpClient.put(`api/procedures/${procedureSent.id}`, formData).subscribe((procedureReceived: any) => {
      this.procedureArray = this.procedureArray.map(p => {
        if (p.id === procedureReceived.id) {
          return {
            ...procedureReceived,
            steps: this.parseJson(procedureReceived.steps),
            questions: this.parseJson(procedureReceived.questions)
          };
        }
        return p;
      });
    });
  }

  removeProcedure(id: number) {
    this.procedureArray = this.procedureArray.filter(p => p.id !== id);
    this.httpClient.delete(`api/procedures/${id}`).subscribe(() => {
      this.refreshProcedures();
    }, error => {
      console.error('Erreur lors de la suppression de la procédure :', error);
    });
  }

  private parseJson(value: any): string[] {
    if (Array.isArray(value)) return value;
    if (!value || value === 'null') return [];
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
}
