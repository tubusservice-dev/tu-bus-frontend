import { Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

export type AccountBlockedCode =
  | 'ACCOUNT_BLOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_NOT_FOUND';

export interface AccountBlockedInfo {
  code: AccountBlockedCode;
  message: string;
  reason?: string;
}

const BLOCK_CODES: ReadonlySet<AccountBlockedCode> = new Set<AccountBlockedCode>([
  'ACCOUNT_BLOCKED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
  'ACCOUNT_NOT_FOUND',
]);

/**
 * Holds the global "account blocked" state that drives the
 * blocked-account modal. Fed by every auth flow that can receive a
 * blocked/suspended/deleted/not-found response from the backend.
 */
@Injectable({
  providedIn: 'root',
})
export class AccountBlockedStore {
  private readonly blockedInfoSignal = signal<AccountBlockedInfo | null>(null);
  readonly blockedInfo = this.blockedInfoSignal.asReadonly();

  triggerAccountBlocked(error: HttpErrorResponse | null | undefined): boolean {
    const body = error?.error as
      | { code?: string; message?: string; details?: { reason?: string } }
      | undefined;
    const code = body?.code;
    if (!code || !BLOCK_CODES.has(code as AccountBlockedCode)) return false;

    this.blockedInfoSignal.set({
      code: code as AccountBlockedCode,
      message: body?.message || 'Tu cuenta no puede acceder al sistema.',
      reason: body?.details?.reason,
    });
    return true;
  }

  clearAccountBlocked(): void {
    this.blockedInfoSignal.set(null);
  }

  notifyAccountBlocked(code: AccountBlockedCode, message: string, reason?: string): void {
    this.blockedInfoSignal.set({ code, message, reason });
  }
}
