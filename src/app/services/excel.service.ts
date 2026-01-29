import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ExcelService {

  constructor(private httpClient: HttpClient) {}

  /**
   * Récupère la liste des fichiers Excel mensuels
   */
  async getMonthlyFiles(): Promise<any[]> {
    return firstValueFrom(
      this.httpClient.get<any[]>('api/excel/monthly-files')
    );
  }

  /**
   * Télécharge un fichier Excel mensuel
   */
  async downloadMonthlyExcel(filename: string): Promise<Blob> {
    return firstValueFrom(
      this.httpClient.get(`api/excel/download/${filename}`, {
        responseType: 'blob'
      })
    );
  }

  /**
   * Met à jour le fichier Excel mensuel avec un nouveau contrôle
   */
  async updateMonthlyExcel(payload: any): Promise<void> {
    return firstValueFrom(
      this.httpClient.post<void>('api/excel/update-monthly', payload)
    );
  }
}
