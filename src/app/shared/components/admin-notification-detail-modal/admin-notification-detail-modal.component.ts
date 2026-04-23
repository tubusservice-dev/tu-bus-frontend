import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminNotification, NotificationType } from '../../../models/notification.model';
import { DISPATCH_TYPE_LABELS, DispatchType } from '../../../models/order.model';
import { PAYMENT_METHOD_TYPE_LABELS, PaymentMethodType } from '../../../models/payment-method.model';

/**
 * Admin-facing modal that renders the full payload of an admin notification.
 * Consumes the optional `metadata` bag produced by the backend emitters and
 * groups it into Orden / Cliente / Mecánico / Contexto sections.
 */
@Component({
  selector: 'app-admin-notification-detail-modal',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-notification-detail-modal.component.html',
  styleUrl: './admin-notification-detail-modal.component.scss',
})
export class AdminNotificationDetailModalComponent {
  private readonly _notification = signal<AdminNotification | null>(null);

  @Input({ required: true })
  set notification(value: AdminNotification | null) {
    this._notification.set(value);
  }

  @Output() closed = new EventEmitter<void>();

  protected readonly n = this._notification.asReadonly();

  protected readonly meta = computed(() => this._notification()?.metadata || {});

  protected readonly typeBadgeClass = computed(() => {
    const type = this._notification()?.type;
    switch (type) {
      case 'mechanic_rejection': return 'mechanic';
      case 'customer_cancellation': return 'customer';
      case 'new_order': return 'new-order';
      case 'payment_note': return 'payment-note';
      case 'service_progress': return 'service-progress';
      case 'order_comment': return 'payment-note';
      case 'order_approved': return 'new-order';
      case 'dispatch_update': return 'service-progress';
      default: return '';
    }
  });

  protected readonly orderId = computed(() => {
    const notif = this._notification();
    if (!notif?.relatedOrder) return '';
    if (typeof notif.relatedOrder === 'object') {
      return notif.relatedOrder.id || notif.relatedOrder._id || '';
    }
    return String(notif.relatedOrder);
  });

  protected getNotificationTypeLabel(type: NotificationType | string): string {
    const labels: Record<string, string> = {
      mechanic_rejection: 'Rechazo de mecánico',
      customer_cancellation: 'Cancelación de cliente',
      new_order: 'Nueva orden',
      payment_note: 'Comentario de pago',
      service_progress: 'Progreso del servicio',
      order_approved: 'Orden aprobada',
      dispatch_update: 'Actualización de despacho',
      order_comment: 'Comentario del cliente',
    };
    return labels[type] || String(type);
  }

  protected getDispatchTypeLabel(type: string): string {
    return DISPATCH_TYPE_LABELS[type as DispatchType] || type;
  }

  protected getPaymentMethodLabel(method: string): string {
    return PAYMENT_METHOD_TYPE_LABELS[method as PaymentMethodType] || method;
  }

  protected getStepLabel(step: string): string {
    const labels: Record<string, string> = {
      en_camino: 'En camino',
      en_proceso: 'En servicio',
      completado: 'Completado',
      asignado: 'Asignado',
    };
    return labels[step] || step;
  }

  protected formatMoney(value: unknown): string {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    return `$${n.toFixed(2)}`;
  }

  protected close(): void {
    this.closed.emit();
  }
}
