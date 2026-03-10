import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from 'rxjs';

export interface ScanResponse {
  success: boolean;
  value: string;
  timestamp: number;
}

export interface BatchLockerResponse {
  successCount: number;
  failCount: number;
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class ScanService {

  private availableStocksArray: any[] = [];
  private loanedStocksArray: any[] = [];
  private usersArray: any[] = [];

  constructor(private httpClient: HttpClient) {
    this.refreshAvailableStocks();
    this.refreshLoanedStocks();
    this.refreshUsers();
  }

  /* ========================================
   * GESTION CASIERS (OPEN/CLOSE)
   * ======================================== */

  /**
   * Ouvre un casier spécifique
   */
  async openLocker(lockerNumber: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.httpClient.post(`api/locker/open/${lockerNumber}`, {})
      );
    } catch (error) {
      console.error('Erreur ouverture casier:', error);
      throw error;
    }
  }

  /**
   * Ferme un casier spécifique
   */
  async closeLocker(lockerNumber: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.httpClient.post(`api/locker/close/${lockerNumber}`, {})
      );
    } catch (error) {
      console.error('Erreur Fermeture casier:', error);
      throw error;
    }
  }

  /**
   * ✅ Ouvre TOUS les casiers (1 à 24) en une seule requête backend
   */
  async openAllLockers(): Promise<BatchLockerResponse> {
    try {
      console.log('📤 Requête ouverture de tous les casiers...');

      const response = await firstValueFrom(
        this.httpClient.post<BatchLockerResponse>('api/locker/all/open', {})
      );

      console.log('✅ Réponse ouverture:', response);
      return response;

    } catch (error) {
      console.error('❌ Erreur ouverture tous casiers:', error);
      throw error;
    }
  }

  /**
   * ✅ Ferme TOUS les casiers (1 à 24) en une seule requête backend
   */
  async closeAllLockers(): Promise<BatchLockerResponse> {
    try {
      console.log('📤 Requête fermeture de tous les casiers...');

      const response = await firstValueFrom(
        this.httpClient.post<BatchLockerResponse>('api/locker/all/close', {})
      );

      console.log('✅ Réponse fermeture:', response);
      return response;

    } catch (error) {
      console.error('❌ Erreur fermeture tous casiers:', error);
      throw error;
    }
  }

  /* ========================================
   * SCAN API (utilisé par les composants)
   * ======================================== */

  /**
   * ✅ Lit la valeur (SANS cache)
   */
  async readScan(): Promise<ScanResponse> {
    try {
      // ✅ Force un timestamp unique pour éviter le cache HTTP
      const timestamp = Date.now();

      const response = await firstValueFrom(
        this.httpClient.post<ScanResponse>(
          `api/scan/read?t=${timestamp}`,  // ✅ Query param anti-cache
          {},
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',  // ✅ Désactive cache
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        )
      );

      return response;

    } catch (error) {
      console.error('[ScanService] Erreur lecture:', error);
      return { success: false, value: '', timestamp: 0 };
    }
  }

  /**
   * Efface la valeur dans l'automate
   */
  async clearScan(): Promise<any> {
    try {
      return await firstValueFrom(
        this.httpClient.post('api/scan/clear', {})
      );
    } catch (error) {
      console.error('Erreur clear scan:', error);
      throw error;
    }
  }

  /**
   * Vérifie la connexion PLC
   */
  async healthCheck(): Promise<any> {
    try {
      return await firstValueFrom(
        this.httpClient.get('api/scan/health')
      );
    } catch (error) {
      console.error('Erreur health check PLC:', error);
      throw error;
    }
  }

  /* ========================================
   * REFRESH DATA
   * ======================================== */

  refreshData() {
    return Promise.all([
      this.refreshAvailableStocks(),
      this.refreshLoanedStocks(),
      this.refreshUsers()
    ]);
  }

  refreshAvailableStocks(){
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/stocks/getAvailableStocks').subscribe(
        (stocks: any) => {
          this.availableStocksArray = stocks;
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  refreshLoanedStocks(){
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/stocks/getUnavailableStocks').subscribe(
        (stocks: any) => {
          this.loanedStocksArray = stocks;
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  refreshUsers(){
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/users').subscribe(
        (users: any) => {
          this.usersArray = users;
          resolve();
        },
        error => {
          reject(error);
        }
      );
    });
  }

  /* ========================================
   * GETTERS
   * ======================================== */

  getAvailableStocks() {
    return this.availableStocksArray;
  }

  getLoanedStocks() {
    return this.loanedStocksArray;
  }

  getUsers() {
    return this.usersArray;
  }

  /* ========================================
   * HISTORY
   * ======================================== */

  async createHistory(history: any): Promise<void> {
    await firstValueFrom(this.httpClient.post('api/history', history));
  }
}
