import { Component, inject, signal, input, output, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { OrderService } from '../../../../core/services/order.service';
import { Mechanic } from '../../../../models/mechanic.model';
import {
  Order,
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_COLORS,
} from '../../../../models/order.model';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-order-dispatch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="onClose()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">Asignar Despacho</h3>
            <button type="button" class="btn-close" (click)="onClose()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Order Info -->
          <div class="order-info">
            <span class="order-number">Orden #{{ order()?.orderNumber }}</span>
            @if (order()?.dispatchStatus) {
              <span class="dispatch-badge" [ngClass]="getDispatchStatusColor(order()!.dispatchStatus!)">
                {{ getDispatchStatusLabel(order()!.dispatchStatus!) }}
              </span>
            }
          </div>

          <!-- Mechanic already assigned -->
          @if (assignedMechanic()) {
            <div class="assigned-section">
              <div class="assigned-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-check-circle">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>Mecanico asignado</span>
              </div>
              <div class="mechanic-info">
                <p class="mechanic-name">{{ assignedMechanic()!.name }}</p>
                <p class="mechanic-phone">{{ assignedMechanic()!.phone }}</p>
              </div>

              <!-- Magic Link -->
              @if (magicLink()) {
                <div class="magic-link-section">
                  <label class="link-label">Enlace del mecanico:</label>
                  <div class="link-box">
                    <input
                      type="text"
                      [value]="magicLink()"
                      readonly
                      class="link-input"
                    />
                    <button type="button" class="btn-copy" (click)="copyLink()">
                      @if (linkCopied()) {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      } @else {
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                        </svg>
                      }
                    </button>
                  </div>

                  <!-- WhatsApp button -->
                  @if (assignedMechanic()?.whatsapp || assignedMechanic()?.phone) {
                    <a
                      [href]="getWhatsAppUrl()"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="btn-whatsapp"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" class="whatsapp-icon">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                      </svg>
                      Enviar por WhatsApp
                    </a>
                  }
                </div>
              }
            </div>
          } @else {
            <!-- Select Mechanic -->
            <div class="select-section">
              @if (isLoadingMechanics()) {
                <div class="loading-mechanics">
                  <div class="spinner-sm"></div>
                  <span>Cargando mecanicos...</span>
                </div>
              } @else {
                <div class="form-group">
                  <label for="mechanic-select">Seleccionar Mecanico</label>
                  <select
                    id="mechanic-select"
                    [(ngModel)]="selectedMechanicId"
                    class="mechanic-select"
                  >
                    <option value="">-- Seleccionar --</option>
                    @for (mechanic of activeMechanics(); track mechanic.id) {
                      <option [value]="mechanic.id">
                        {{ mechanic.name }} - {{ mechanic.whatsapp }}
                      </option>
                    }
                  </select>
                </div>

                @if (assignError()) {
                  <div class="assign-error">{{ assignError() }}</div>
                }

                <button
                  type="button"
                  class="btn-assign"
                  [disabled]="!selectedMechanicId || isAssigning()"
                  (click)="assignMechanic()"
                >
                  @if (isAssigning()) {
                    <span class="spinner-sm-white"></span>
                    Asignando...
                  } @else {
                    Asignar Mecanico
                  }
                </button>
              }
            </div>
          }

          <!-- Footer -->
          <div class="modal-footer">
            <button type="button" class="btn-close-footer" (click)="onClose()">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay {
      @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4;
    }

    .modal-content {
      @apply bg-white dark:bg-gray-800 rounded-xl max-w-md w-full shadow-xl;
    }

    .modal-header {
      @apply flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700;
    }

    .modal-title {
      @apply text-lg font-semibold text-gray-900 dark:text-white;
    }

    .btn-close {
      @apply p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors;

      svg {
        @apply w-5 h-5;
      }
    }

    .order-info {
      @apply flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-700/50;
    }

    .order-number {
      @apply text-sm font-medium text-gray-900 dark:text-white;
    }

    .dispatch-badge {
      @apply inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full;
    }

    // Assigned section
    .assigned-section {
      @apply p-5 space-y-4;
    }

    .assigned-header {
      @apply flex items-center gap-2 text-green-600 dark:text-green-400;

      .icon-check-circle {
        @apply w-5 h-5;
      }

      span {
        @apply text-sm font-medium;
      }
    }

    .mechanic-info {
      @apply bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3;

      .mechanic-name {
        @apply font-medium text-gray-900 dark:text-white text-sm;
      }

      .mechanic-phone {
        @apply text-xs text-gray-500 dark:text-gray-400;
      }
    }

    .magic-link-section {
      @apply space-y-2;
    }

    .link-label {
      @apply block text-sm font-medium text-gray-700 dark:text-gray-300;
    }

    .link-box {
      @apply flex gap-2;
    }

    .link-input {
      @apply flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300;
      @apply focus:outline-none;
    }

    .btn-copy {
      @apply px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg;
      @apply hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors;

      svg {
        @apply w-4 h-4 text-gray-600 dark:text-gray-400;
      }
    }

    .btn-whatsapp {
      @apply inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg;
      @apply hover:bg-green-700 transition-colors;

      .whatsapp-icon {
        @apply w-5 h-5;
      }
    }

    // Select section
    .select-section {
      @apply p-5 space-y-4;
    }

    .loading-mechanics {
      @apply flex items-center gap-2 justify-center py-4 text-gray-500 dark:text-gray-400 text-sm;
    }

    .form-group {
      label {
        @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5;
      }
    }

    .mechanic-select {
      @apply w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg;
      @apply text-gray-900 dark:text-white;
      @apply focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent;
    }

    .assign-error {
      @apply p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg;
    }

    .btn-assign {
      @apply w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg;
      @apply hover:bg-red-700 transition-colors;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
    }

    .spinner-sm {
      @apply w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-red-600 rounded-full animate-spin;
    }

    .spinner-sm-white {
      @apply w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin;
    }

    // Footer
    .modal-footer {
      @apply px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end;
    }

    .btn-close-footer {
      @apply px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg;
      @apply hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors;
    }
  `],
})
export class OrderDispatchModalComponent implements OnInit {
  private readonly mechanicService = inject(MechanicService);
  private readonly orderService = inject(OrderService);

  readonly order = input<Order | null>(null);
  readonly isOpen = input<boolean>(false);

  readonly close = output<void>();
  readonly assigned = output<Order>();

  protected readonly isLoadingMechanics = signal(true);
  protected readonly activeMechanics = signal<Mechanic[]>([]);
  protected readonly isAssigning = signal(false);
  protected readonly assignError = signal<string | null>(null);
  protected readonly linkCopied = signal(false);
  protected selectedMechanicId = '';

  protected readonly assignedMechanic = signal<{ name: string; phone: string; whatsapp?: string } | null>(null);
  protected readonly magicLink = signal<string | null>(null);

  constructor() {
    effect(() => {
      const currentOrder = this.order();
      if (currentOrder && this.isOpen()) {
        this.updateFromOrder(currentOrder);
      }
    });
  }

  ngOnInit(): void {
    this.loadMechanics();
  }

  private updateFromOrder(order: Order): void {
    if (order.mechanic && typeof order.mechanic === 'object') {
      this.assignedMechanic.set({
        name: order.mechanic.name,
        phone: order.mechanic.phone,
        whatsapp: order.mechanic.whatsapp,
      });
      if (order.mechanicToken) {
        this.magicLink.set(`${environment.apiUrl.replace('/api', '')}/mechanic/order/${order.mechanicToken}`);
      }
    } else {
      this.assignedMechanic.set(null);
      this.magicLink.set(null);
    }
  }

  private loadMechanics(): void {
    this.isLoadingMechanics.set(true);
    this.mechanicService.getAll(1, 100).subscribe({
      next: (response) => {
        this.activeMechanics.set(response.data.filter((m) => m.isActive));
        this.isLoadingMechanics.set(false);
      },
      error: () => {
        this.isLoadingMechanics.set(false);
      },
    });
  }

  assignMechanic(): void {
    const order = this.order();
    if (!order || !this.selectedMechanicId) return;

    this.isAssigning.set(true);
    this.assignError.set(null);

    this.orderService.assignMechanic(order.id, this.selectedMechanicId).subscribe({
      next: (response) => {
        this.isAssigning.set(false);
        this.updateFromOrder(response.data);
        this.assigned.emit(response.data);
      },
      error: (error) => {
        this.isAssigning.set(false);
        this.assignError.set(error.error?.message || 'Error al asignar mecanico');
      },
    });
  }

  copyLink(): void {
    const link = this.magicLink();
    if (!link) return;

    navigator.clipboard.writeText(link).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  getWhatsAppUrl(): string {
    const mechanic = this.assignedMechanic();
    const link = this.magicLink();
    if (!mechanic || !link) return '';

    const phone = mechanic.whatsapp || mechanic.phone;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `Hola ${mechanic.name}, se te ha asignado una orden. Accede a los detalles aqui: ${link}`
    );
    return `https://wa.me/${cleanPhone}?text=${message}`;
  }

  getDispatchStatusLabel(status: string): string {
    return DISPATCH_STATUS_LABELS[status] || status;
  }

  getDispatchStatusColor(status: string): string {
    return DISPATCH_STATUS_COLORS[status] || '';
  }

  onClose(): void {
    this.close.emit();
  }
}
