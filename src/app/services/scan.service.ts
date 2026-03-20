import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, Observable } from 'rxjs';

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

export interface BatchLockerResult {
  requested: number[];
  succeeded: number[];
  failed: number[];
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
   * GESTION CASIERS — COMMANDES INDIVIDUELLES
   * ======================================== */

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

  async closeLocker(lockerNumber: number): Promise<any> {
    try {
      return await firstValueFrom(
        this.httpClient.post(`api/locker/close/${lockerNumber}`, {})
      );
    } catch (error) {
      console.error('Erreur fermeture casier:', error);
      throw error;
    }
  }

  /* ========================================
   * GESTION CASIERS — COMMANDES BATCH
   * Ouvre / ferme plusieurs casiers en 1 seule requête HTTP
   * → le backend envoie une requête JSON-RPC batch au S7-1200
   * ======================================== */

  /**
   * Ouvre une liste de casiers en une seule requête.
   * Retourne { requested, succeeded, failed } pour gérer les ouvertures partielles.
   */
  openLockers(lockerIds: number[]): Observable<BatchLockerResult> {
    return this.httpClient.post<BatchLockerResult>(
      'api/locker/openLockers',
      { lockerIds }
    );
  }

  /**
   * Ferme une liste de casiers en une seule requête.
   * Retourne { requested, succeeded, failed } pour gérer les fermetures partielles.
   */
  closeLockers(lockerIds: number[]): Observable<BatchLockerResult> {
    return this.httpClient.post<BatchLockerResult>(
      'api/locker/closeLockers',
      { lockerIds }
    );
  }

  /* ========================================
   * GESTION CASIERS — MANAGE ALL
   * ======================================== */

  async openAllLockers(): Promise<BatchLockerResponse> {
    try {
      return await firstValueFrom(
        this.httpClient.post<BatchLockerResponse>('api/locker/all/open', {})
      );
    } catch (error) {
      console.error('Erreur ouverture tous casiers:', error);
      throw error;
    }
  }

  async closeAllLockers(): Promise<BatchLockerResponse> {
    try {
      return await firstValueFrom(
        this.httpClient.post<BatchLockerResponse>('api/locker/all/close', {})
      );
    } catch (error) {
      console.error('Erreur fermeture tous casiers:', error);
      throw error;
    }
  }

  /* ========================================
   * SCAN API
   * ======================================== */

  async readScan(): Promise<ScanResponse> {
    try {
      const timestamp = Date.now();
      return await firstValueFrom(
        this.httpClient.post<ScanResponse>(
          `api/scan/read?t=${timestamp}`,
          {},
          {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        )
      );
    } catch (error) {
      console.error('[ScanService] Erreur lecture:', error);
      return { success: false, value: '', timestamp: 0 };
    }
  }

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

  refreshAvailableStocks() {
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/stocks/getAvailableStocks').subscribe(
        (stocks: any) => { this.availableStocksArray = stocks; resolve(); },
        error => reject(error)
      );
    });
  }

  refreshLoanedStocks() {
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/stocks/getUnavailableStocks').subscribe(
        (stocks: any) => { this.loanedStocksArray = stocks; resolve(); },
        error => reject(error)
      );
    });
  }

  refreshUsers() {
    return new Promise<void>((resolve, reject) => {
      this.httpClient.get('api/users').subscribe(
        (users: any) => { this.usersArray = users; resolve(); },
        error => reject(error)
      );
    });
  }

  /* ========================================
   * GETTERS
   * ======================================== */

  getAvailableStocks() { return this.availableStocksArray; }
  getLoanedStocks()    { return this.loanedStocksArray; }
  getUsers()           { return this.usersArray; }

  /* ========================================
   * HISTORY
   * ======================================== */

  async createHistory(history: any): Promise<void> {
    await firstValueFrom(this.httpClient.post('api/history', history));
  }
}
