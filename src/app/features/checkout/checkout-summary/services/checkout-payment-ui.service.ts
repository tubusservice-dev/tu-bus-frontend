import { Injectable, OnDestroy, Signal, computed, inject, signal } from '@angular/core';
import { PaymentMethodService } from '@core/services/payment-method.service';
import { UploadService } from '@core/services/upload.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { ClipboardService } from '@shared/services/clipboard.service';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';
import {
  PaymentMethodConfig,
  PaymentMethodType,
  PaymentMethodGroup,
  PAYMENT_METHOD_TYPE_LABELS,
  PAYMENT_METHOD_ICON_CLASS,
  PAYMENT_TYPES_WITH_FORM,
  PAYMENT_TYPES_INFO_ONLY,
} from '@models/payment-method.model';
import { PaymentSubmission } from '@models/order.model';
import { DispatchType } from '@features/checkout/services/checkout.service';

/**
 * UI state holder for the payment section of the checkout summary.
 *
 * Owns the full lifecycle of the payment modal (open/close, method selection,
 * form validation, proof upload, submission). Exposes signals consumed by the
 * summary template via passthroughs on the component — the template is not
 * aware that the state moved out of the component.
 *
 * Lifecycle:
 *   - Registered via `providers: [...]` on `CheckoutSummaryComponent`, so its
 *     instance is bound to the component's lifetime.
 *   - The component must call `init()` once before the service is used so
 *     dependent context (current order total, active dispatch type, today
 *     ISO and error reporter) is available to the computeds.
 *   - `ngOnDestroy` drains any scroll locks held by the modal — guarantees
 *     the page underneath is never frozen after navigation.
 */
@Injectable()
export class CheckoutPaymentUiService implements OnDestroy {
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly uploadService = inject(UploadService);
  private readonly exchangeRateService = inject(ExchangeRateService);
  private readonly clipboard = inject(ClipboardService);
  private readonly scrollLock = inject(BodyScrollLockService);

  // ── Context provided by the owning component ────────────────────────────

  private totalSignal: Signal<number> = computed(() => 0);
  private dispatchTypeSignal: Signal<DispatchType | null> = computed(() => null);
  private todayStr = '';
  private reportError: (msg: string | null) => void = () => { /* no-op */ };

  /**
   * Wires the service to its owning component. Must be called once during
   * the component's `ngOnInit` (or earlier) before any template binding
   * consumes a computed that depends on these inputs.
   */
  init(deps: {
    total: Signal<number>;
    dispatchType: Signal<DispatchType | null>;
    todayStr: string;
    reportError: (msg: string | null) => void;
  }): void {
    this.totalSignal = deps.total;
    this.dispatchTypeSignal = deps.dispatchType;
    this.todayStr = deps.todayStr;
    this.reportError = deps.reportError;
  }

  // ── State ───────────────────────────────────────────────────────────────

  readonly paymentMethods = signal<PaymentMethodConfig[]>([]);
  readonly loadingMethods = signal(true);

  readonly showModal = signal(false);
  readonly selectedGroup = signal<PaymentMethodGroup | null>(null);
  readonly selectedMethodInModal = signal<PaymentMethodConfig | null>(null);
  readonly isSubmittingPayment = signal(false);

  readonly formReferenceNumber = signal('');
  readonly formSourceBank = signal('');
  readonly formSenderName = signal('');
  readonly formAmount = signal('');
  readonly formPaymentDate = signal('');
  readonly formProofFile = signal<File | null>(null);
  readonly formProofPreview = signal<string | null>(null);

  readonly paymentSubmitted = signal(false);
  readonly submittedPayment = signal<PaymentSubmission | null>(null);
  readonly submittedMethodType = signal<PaymentMethodType | null>(null);

  readonly copiedAll = signal(false);
  private copyAllTimeout: ReturnType<typeof setTimeout> | null = null;

  private heldScrollLocks = 0;

  /** List of Venezuelan banks for the `sourceBank` dropdown. */
  readonly venezuelanBanks: string[] = [
    'Banco de Venezuela (BDV)',
    'Banco Nacional de Crédito (BNC)',
    'Banco Mercantil',
    'Banco Provincial (BBVA)',
    'Banesco',
    'Banco del Tesoro',
    'Banco Bicentenario',
    'Banco Exterior',
    'Banco Caroní',
    'Banco Venezolano de Crédito',
    'Banco Plaza',
    'Banco Fondo Común (BFC)',
    'Banco Sofitasa',
    'Banco del Caribe (Bancaribe)',
    'Banco Activo',
    'Bancrecer',
    'Mi Banco',
    'Banco Agrícola de Venezuela',
    'Banplus',
    'Banco Internacional de Desarrollo',
    'Bancamiga',
    'Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)',
    '100% Banco',
    'Banco de la Gente Emprendedora (Bangente)',
  ];

  // ── Computeds ───────────────────────────────────────────────────────────

  /** Payment methods grouped by type (e.g. all pago_movil under one card). */
  readonly paymentGroups = computed<PaymentMethodGroup[]>(() => {
    const methods = this.paymentMethods();
    const groupMap = new Map<PaymentMethodType, PaymentMethodConfig[]>();

    for (const method of methods) {
      const existing = groupMap.get(method.type) || [];
      existing.push(method);
      groupMap.set(method.type, existing);
    }

    return Array.from(groupMap.entries()).map(([type, methods]) => ({
      type,
      label: PAYMENT_METHOD_TYPE_LABELS[type],
      methods,
    }));
  });

  /** True when the payment date typed by the user is in the future. */
  readonly isPaymentDateInvalid = computed(() => {
    const d = this.formPaymentDate();
    return !!d && d > this.todayStr;
  });

  /**
   * Modal copy for info-only payment methods (tarjeta / efectivo). The wording
   * adapts to the current dispatch type so the message stays truthful for each
   * combination — e.g. for a delivery the customer pays at the door, not at
   * the store; for an agency we coordinate the charge before dispatch; etc.
   */
  readonly infoOnlyMessage = computed<string>(() => {
    const group = this.selectedGroup();
    if (!group) return '';
    const dispatch = this.dispatchTypeSignal();

    if (group.type === PaymentMethodType.TARJETA) {
      switch (dispatch) {
        case 'store_pickup':
        case 'in_store_oil_change':
          return 'Pagarás con tu tarjeta directamente en la tienda al retirar tu pedido. Aceptamos débito y crédito.';
        case 'oil_change_service':
          return 'Nuestro técnico llevará el punto de venta. Pagarás con tu tarjeta cuando finalice el servicio.';
        case 'local_delivery':
          return 'Nuestro repartidor llevará el punto de venta. Pagarás con tu tarjeta al recibir tu pedido.';
        case 'shipping_agency':
          return 'Te contactaremos para coordinar el pago con tarjeta antes de despachar a la agencia.';
        case 'seller_agreement':
        default:
          return 'Te contactaremos para coordinar el pago con tarjeta.';
      }
    }

    if (group.type === PaymentMethodType.EFECTIVO_DIVISAS) {
      switch (dispatch) {
        case 'store_pickup':
        case 'in_store_oil_change':
          return 'Pagarás en efectivo (USD) directamente en la tienda al retirar tu pedido.';
        case 'oil_change_service':
          return 'Pagarás en efectivo (USD) al finalizar el servicio. Te sugerimos tener el monto exacto.';
        case 'local_delivery':
          return 'Pagarás en efectivo (USD) al recibir tu pedido. Te sugerimos tener el monto exacto.';
        case 'shipping_agency':
          return 'Te contactaremos para coordinar el pago en efectivo (USD) antes de despachar a la agencia.';
        case 'seller_agreement':
        default:
          return 'Te contactaremos para coordinar el pago en efectivo (USD).';
      }
    }

    return '';
  });

  /**
   * True when the amount field should be locked. For Bs-based methods it
   * requires a valid exchange rate; when the rate is unavailable we fall back
   * to editable so the user can still complete the form manually. Zelle is
   * always locked because USD is native to the order total.
   */
  readonly amountReadonly = computed<boolean>(() => {
    const g = this.selectedGroup();
    if (!g) return false;
    if (g.type === PaymentMethodType.PAGO_MOVIL || g.type === PaymentMethodType.TRANSFERENCIA) {
      return this.exchangeRateService.convertToBs(this.totalSignal()) !== null;
    }
    return g.type === PaymentMethodType.ZELLE;
  });

  // ── API ─────────────────────────────────────────────────────────────────

  loadPaymentMethods(): void {
    this.loadingMethods.set(true);
    this.paymentMethodService.getActive().subscribe({
      next: (res) => {
        this.paymentMethods.set(res.data);
        this.loadingMethods.set(false);
      },
      error: () => {
        this.loadingMethods.set(false);
      },
    });
  }

  openPaymentModal(group: PaymentMethodGroup): void {
    if (this.paymentSubmitted()) return;
    this.selectedGroup.set(group);
    // Auto-select first method if only one
    if (group.methods.length === 1) {
      this.selectedMethodInModal.set(group.methods[0]);
    } else {
      this.selectedMethodInModal.set(null);
    }
    this.resetForm();
    // Prefill amount with the exact figure the user should pay. For
    // pago_movil/transferencia it's the Bs conversion; for binance it's the
    // USD total (≈ USDT). Leaves empty when Bs conversion is unavailable so
    // the user can manually type.
    const prefilled = this.computePrefilledAmount(group.type);
    this.formAmount.set(prefilled);
    this.showModal.set(true);
    this.acquireScrollLock();
  }

  /** Label for the reference-number input. Zelle users copy a confirmation
   *  number from their banking app, so the wording changes to match. */
  referenceLabel(): string {
    return this.selectedGroup()?.type === PaymentMethodType.ZELLE
      ? 'Número de confirmación'
      : 'Número de referencia';
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedGroup.set(null);
    this.selectedMethodInModal.set(null);
    this.isSubmittingPayment.set(false);
    this.resetForm();
    this.releaseScrollLock();
  }

  selectMethodInModal(method: PaymentMethodConfig): void {
    this.selectedMethodInModal.set(method);
  }

  onFormInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'referenceNumber': this.formReferenceNumber.set(value); break;
      case 'sourceBank': this.formSourceBank.set(value); break;
      case 'senderName': this.formSenderName.set(value); break;
      case 'amount': this.formAmount.set(value); break;
      case 'paymentDate': this.formPaymentDate.set(value); break;
    }
  }

  onProofFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.formProofFile.set(file);
      const reader = new FileReader();
      reader.onload = () => this.formProofPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  removeProofFile(): void {
    this.formProofFile.set(null);
    this.formProofPreview.set(null);
  }

  isFormValid(): boolean {
    const group = this.selectedGroup();
    if (!group) return false;

    if (this.isInfoOnlyType(group.type)) {
      return true; // No form required
    }

    if (this.isFormType(group.type)) {
      // Zelle has a distinct field set: no sourceBank (USA banks not listed),
      // plus a required senderName to match the incoming Zelle notification.
      if (group.type === PaymentMethodType.ZELLE) {
        return !!(
          this.formReferenceNumber().trim() &&
          this.formSenderName().trim() &&
          this.formAmount().trim() &&
          this.formPaymentDate().trim()
        );
      }
      return !!(
        this.formReferenceNumber().trim() &&
        this.formSourceBank().trim() &&
        this.formAmount().trim() &&
        this.formPaymentDate().trim()
      );
    }

    return false;
  }

  submitPayment(): void {
    if (this.isSubmittingPayment()) return;

    const group = this.selectedGroup();
    const selectedMethod = this.selectedMethodInModal();
    if (!group) return;

    const submission: PaymentSubmission = {
      methodType: group.type,
      methodLabel: selectedMethod?.label || group.label,
      selectedMethodId: selectedMethod?.id,
    };

    if (this.isFormType(group.type)) {
      // Validate payment date is not in the future
      const paymentDate = this.formPaymentDate();
      if (paymentDate && paymentDate > this.todayStr) {
        this.reportError('La fecha de pago no puede ser futura');
        return;
      }
      submission.referenceNumber = this.formReferenceNumber().trim();
      submission.amount = parseFloat(this.formAmount()) || 0;
      submission.paymentDate = paymentDate;
      // Zelle ships senderName instead of sourceBank (no VE banks apply).
      if (group.type === PaymentMethodType.ZELLE) {
        submission.senderName = this.formSenderName().trim();
      } else {
        submission.sourceBank = this.formSourceBank().trim();
      }
    }

    this.isSubmittingPayment.set(true);
    this.reportError(null);

    // Upload proof file if selected, then finalize
    if (this.formProofFile()) {
      this.uploadService.uploadImage(this.formProofFile()!, 'payment-proofs').subscribe({
        next: (uploadRes) => {
          if (!uploadRes?.data?.url) {
            this.isSubmittingPayment.set(false);
            this.reportError('Error al subir el comprobante: respuesta invalida del servidor. Intenta nuevamente.');
            return;
          }
          submission.proofUrl = uploadRes.data.url;
          submission.proofPublicId = uploadRes.data.publicId;
          this.finalizePaymentSubmission(submission, group.type);
        },
        error: (err) => {
          // Stop the submission and surface the error so the user can retry
          this.isSubmittingPayment.set(false);
          const msg = err?.error?.message || 'No se pudo subir el comprobante. Verifica tu conexion e intenta nuevamente.';
          this.reportError(msg);
        },
      });
    } else {
      this.finalizePaymentSubmission(submission, group.type);
    }
  }

  clearPaymentSubmission(): void {
    this.paymentSubmitted.set(false);
    this.submittedPayment.set(null);
    this.submittedMethodType.set(null);
  }

  isFormType(type: PaymentMethodType): boolean {
    return PAYMENT_TYPES_WITH_FORM.includes(type);
  }

  isInfoOnlyType(type: PaymentMethodType): boolean {
    return PAYMENT_TYPES_INFO_ONLY.includes(type);
  }

  getIconClass(type: PaymentMethodType): string {
    return PAYMENT_METHOD_ICON_CLASS[type] || '';
  }

  getCurrencySymbol(type?: string): string {
    if (!type) return '$';
    if (type === 'pago_movil' || type === 'transferencia') return 'Bs';
    if (type === 'binance') return 'USDT';
    return '$';
  }

  formatPaymentAmount(amount?: number, type?: string): string {
    if (!amount) return '';
    const symbol = this.getCurrencySymbol(type);
    const formatted = amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  }

  /** Raw USD total as a paste-ready decimal string (no currency symbol). */
  totalUsdRaw(): string {
    return this.totalSignal().toFixed(2);
  }

  /** Raw Bs total as a paste-ready decimal string, or '' when rate unavailable. */
  totalBsRaw(): string {
    const bs = this.exchangeRateService.convertToBs(this.totalSignal());
    return bs !== null ? bs.toFixed(2) : '';
  }

  async copyAllPaymentDetails(): Promise<void> {
    const text = this.buildPaymentSummary();
    if (!text) return;

    const ok = await this.clipboard.write(text);
    if (!ok) return;

    this.copiedAll.set(true);
    if (this.copyAllTimeout) clearTimeout(this.copyAllTimeout);
    this.copyAllTimeout = setTimeout(() => this.copiedAll.set(false), 1500);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private resetForm(): void {
    this.formReferenceNumber.set('');
    this.formSourceBank.set('');
    this.formSenderName.set('');
    this.formAmount.set('');
    this.formPaymentDate.set('');
    this.formProofFile.set(null);
    this.formProofPreview.set(null);
  }

  /** Returns the pre-filled amount for the current modal's payment type */
  private computePrefilledAmount(type: PaymentMethodType): string {
    if (type === PaymentMethodType.PAGO_MOVIL || type === PaymentMethodType.TRANSFERENCIA) {
      const bs = this.exchangeRateService.convertToBs(this.totalSignal());
      return bs !== null ? bs.toFixed(2) : '';
    }
    if (type === PaymentMethodType.ZELLE) {
      // Zelle settles in USD directly — prefill with the order total, no
      // Bs conversion needed.
      return this.totalSignal().toFixed(2);
    }
    return '';
  }

  /**
   * Builds a human-readable payment-details block that consolidates the
   * selected account info + the amount due. Output shape (example):
   *
   *   Banco: Banesco
   *   Teléfono: 0412-1234567
   *   Cédula: V-12345678
   *   Monto: 1234.56 Bs
   */
  private buildPaymentSummary(): string {
    const method = this.selectedMethodInModal();
    const group = this.selectedGroup();
    if (!method || !group) return '';

    const lines: string[] = [];

    if (method.type === 'pago_movil' && method.pagoMovil) {
      lines.push(`Banco: ${method.pagoMovil.bankName}`);
      lines.push(`Teléfono: ${method.pagoMovil.phoneNumber}`);
      lines.push(`Cédula: ${method.pagoMovil.documentId}`);
    } else if (method.type === 'transferencia' && method.transferencia) {
      lines.push(`Banco: ${method.transferencia.bankName}`);
      lines.push(`Cuenta: ${method.transferencia.accountNumber}`);
      lines.push(`Cédula: ${method.transferencia.documentId}`);
    } else if (method.type === 'zelle' && method.zelle) {
      if (method.zelle.phoneNumber) lines.push(`Teléfono: ${method.zelle.phoneNumber}`);
      if (method.zelle.email) lines.push(`Correo: ${method.zelle.email}`);
    }

    if (group.type === 'pago_movil' || group.type === 'transferencia') {
      const bs = this.totalBsRaw();
      if (bs) lines.push(`Monto: ${bs} Bs`);
    } else {
      lines.push(`Monto: ${this.totalUsdRaw()} USD`);
    }

    return lines.join('\n');
  }

  private finalizePaymentSubmission(submission: PaymentSubmission, methodType: PaymentMethodType): void {
    this.submittedPayment.set(submission);
    this.submittedMethodType.set(methodType);
    this.paymentSubmitted.set(true);
    this.isSubmittingPayment.set(false);
    this.closeModal();
  }

  private acquireScrollLock(): void {
    this.scrollLock.lock();
    this.heldScrollLocks++;
  }

  private releaseScrollLock(): void {
    if (this.heldScrollLocks <= 0) return;
    this.scrollLock.unlock();
    this.heldScrollLocks--;
  }

  ngOnDestroy(): void {
    if (this.copyAllTimeout) {
      clearTimeout(this.copyAllTimeout);
      this.copyAllTimeout = null;
    }
    while (this.heldScrollLocks > 0) {
      this.scrollLock.unlock();
      this.heldScrollLocks--;
    }
  }
}
