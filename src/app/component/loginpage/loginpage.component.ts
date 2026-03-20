import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';

import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ScanService } from '../../services/scan.service';
import { AuthAppService } from '../../services/auth-app.service';
import { UserService } from '../../services/user.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-loginpage',
  standalone: true,
  templateUrl: './loginpage.component.html',
  styleUrls: ['./loginpage.component.css'],
  imports: [NgIf, ToastModule],
  providers: [MessageService]
})
export class LoginpageComponent implements OnInit, OnDestroy {

  private pollingInterval: any;
  private isProcessing = false;

  constructor(
    private scanService: ScanService,
    private authService: AuthAppService,
    private userService: UserService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/scanpage']);
      return;
    }

    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /**
   * ✅ Polling ultra-simple sans RxJS
   */
  private startPolling(): void {

    // Clear initial
    this.scanService.clearScan();

    let pollCount = 0;
    const startTime = Date.now();

    this.pollingInterval = setInterval(() => {
      if (this.isProcessing) return;

      pollCount++;

      // ✅ Appel direct sans await (non-bloquant)
      this.scanService.readScan().then(response => {
        const elapsed = Date.now() - startTime;

        console.log(`[${pollCount}] ${elapsed}ms:`, response);

        // ✅ Détection ultra-simple
        if (response && response.success && response.value) {
          const val = response.value.trim();

          if (val !== '') {
            console.log(`✅ DÉTECTÉ en ${elapsed}ms: "${val}"`);

            this.isProcessing = true;
            this.stopPolling();

            // Login
            this.loginWithBadge(val);
          }
        }
      }).catch(err => {
        console.error('Erreur poll:', err);
      });

    }, 2000);  // ✅ 2000
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('⏹️ POLLING STOP');
    }
  }

  private async loginWithBadge(badgeToken: string): Promise<void> {
    console.log('🔐 Login:', badgeToken);

    try {
      const user = await firstValueFrom(
        this.userService.getUserByBadge(badgeToken)
      );

      if (!user) {
        this.messageService.add({
          severity: 'error',
          summary: 'Badge inconnu',
          detail: `Badge "${badgeToken}" non reconnu`
        });
        this.isProcessing = false;
        this.startPolling();  // Relance
        return;
      }

      this.authService.login({
        id: user.id,
        username: user.username,
        role: user.role
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Connexion réussie',
        detail: `Bonjour, ${user.username}`
      });

      await this.scanService.clearScan();

      setTimeout(() => {
        this.router.navigate(['/scanpage']);
      }, 500);

    } catch (e) {
      console.error('Erreur login:', e);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Connexion impossible'
      });
      this.isProcessing = false;
      this.startPolling();  // Relance
    }
  }
}
