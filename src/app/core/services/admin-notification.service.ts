import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { PaymentService } from './payment.service';

@Injectable({
  providedIn: 'root',
})
export class AdminNotificationService implements OnDestroy {
  private readonly paymentService = inject(PaymentService);
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  readonly pendingPaymentsCount = signal(0);

  private hasAdminToken(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return !!localStorage.getItem('admin_auth_token');
  }

  fetchCounts(): void {
    if (!this.hasAdminToken()) return;
    this.paymentService.getPendingCount().subscribe({
      next: (res) => {
        this.pendingPaymentsCount.set(res.data.count);
      },
      error: () => {
        // Silently fail - don't break the UI
      },
    });
  }

  startPolling(): void {
    // Fetch immediately
    this.fetchCounts();

    // Then poll every 60 seconds
    if (!this.pollingInterval) {
      this.pollingInterval = setInterval(() => {
        this.fetchCounts();
      }, 60_000);
    }
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }
}
