import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountBlockedCode, AuthService } from '../../../core/services/auth.service';

interface ModalCopy {
  title: string;
  tone: 'danger' | 'warning';
  helpText: string;
}

const COPY_BY_CODE: Record<AccountBlockedCode, ModalCopy> = {
  ACCOUNT_BLOCKED: {
    title: 'Cuenta bloqueada',
    tone: 'danger',
    helpText: 'No puedes acceder al sistema. Contacta al soporte si consideras que esto es un error.',
  },
  ACCOUNT_SUSPENDED: {
    title: 'Cuenta suspendida',
    tone: 'warning',
    helpText: 'Tu cuenta está temporalmente suspendida. Contacta al soporte para más información.',
  },
  ACCOUNT_DELETED: {
    title: 'Esta cuenta ya no existe',
    tone: 'danger',
    helpText: 'La cuenta fue eliminada. Si necesitas volver a usar el servicio, crea una cuenta nueva.',
  },
  ACCOUNT_NOT_FOUND: {
    title: 'Cuenta no encontrada',
    tone: 'danger',
    helpText: 'No encontramos la cuenta asociada a esta sesión. Inicia sesión con una cuenta válida.',
  },
};

@Component({
  selector: 'app-blocked-account-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blocked-account-modal.component.html',
  styleUrl: './blocked-account-modal.component.scss',
})
export class BlockedAccountModalComponent {
  private readonly authService = inject(AuthService);

  protected readonly info = this.authService.blockedInfo;

  protected readonly copy = computed<ModalCopy | null>(() => {
    const i = this.info();
    return i ? COPY_BY_CODE[i.code] : null;
  });

  close(): void {
    this.authService.clearAccountBlocked();
  }
}
