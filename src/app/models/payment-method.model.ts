export enum PaymentMethodType {
  PAGO_MOVIL = 'pago_movil',
  TRANSFERENCIA = 'transferencia',
  EFECTIVO_DIVISAS = 'efectivo_divisas',
  TARJETA = 'tarjeta',
  ZELLE = 'zelle',
}

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  [PaymentMethodType.PAGO_MOVIL]: 'Pago Móvil',
  [PaymentMethodType.TRANSFERENCIA]: 'Transferencia Bancaria',
  [PaymentMethodType.EFECTIVO_DIVISAS]: 'Efectivo en Divisas',
  [PaymentMethodType.TARJETA]: 'Pago con Tarjeta',
  [PaymentMethodType.ZELLE]: 'Zelle',
};

export const PAYMENT_METHOD_TYPE_OPTIONS = [
  { value: PaymentMethodType.PAGO_MOVIL, label: 'Pago Móvil' },
  { value: PaymentMethodType.TRANSFERENCIA, label: 'Transferencia Bancaria' },
  { value: PaymentMethodType.EFECTIVO_DIVISAS, label: 'Efectivo en Divisas' },
  { value: PaymentMethodType.TARJETA, label: 'Pago con Tarjeta' },
  { value: PaymentMethodType.ZELLE, label: 'Zelle' },
];

export interface PagoMovilDetails {
  phoneNumber: string;
  bankName: string;
  documentId: string;
}

export interface TransferenciaDetails {
  accountNumber: string;
  bankName: string;
  documentId: string;
}

export interface ZelleDetails {
  phoneNumber?: string;
  email?: string;
}

export interface PaymentMethodConfig {
  id: string;
  type: PaymentMethodType;
  label: string;
  isActive: boolean;
  pagoMovil?: PagoMovilDetails;
  transferencia?: TransferenciaDetails;
  zelle?: ZelleDetails;
  customMessage?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentMethodDto {
  type: PaymentMethodType;
  label: string;
  isActive?: boolean;
  pagoMovil?: PagoMovilDetails;
  transferencia?: TransferenciaDetails;
  zelle?: ZelleDetails;
  customMessage?: string;
  sortOrder?: number;
}

export interface UpdatePaymentMethodDto {
  label?: string;
  isActive?: boolean;
  pagoMovil?: PagoMovilDetails;
  transferencia?: TransferenciaDetails;
  zelle?: ZelleDetails;
  customMessage?: string;
  sortOrder?: number;
}

/** Grupo de métodos del mismo tipo para renderizar un solo botón */
export interface PaymentMethodGroup {
  type: PaymentMethodType;
  label: string;
  methods: PaymentMethodConfig[];
}

/** Iconos CSS class por tipo */
export const PAYMENT_METHOD_ICON_CLASS: Record<PaymentMethodType, string> = {
  [PaymentMethodType.PAGO_MOVIL]: 'pm-icon-movil',
  [PaymentMethodType.TRANSFERENCIA]: 'pm-icon-transfer',
  [PaymentMethodType.EFECTIVO_DIVISAS]: 'pm-icon-cash',
  [PaymentMethodType.TARJETA]: 'pm-icon-card',
  [PaymentMethodType.ZELLE]: 'pm-icon-zelle',
};

/** Tipos que requieren formulario de pago (referencia, banco, monto, fecha) */
export const PAYMENT_TYPES_WITH_FORM: PaymentMethodType[] = [
  PaymentMethodType.PAGO_MOVIL,
  PaymentMethodType.TRANSFERENCIA,
  PaymentMethodType.ZELLE,
];

/** Tipos que solo muestran mensaje informativo */
export const PAYMENT_TYPES_INFO_ONLY: PaymentMethodType[] = [
  PaymentMethodType.EFECTIVO_DIVISAS,
  PaymentMethodType.TARJETA,
];

/**
 * Human-readable one-line summary of a payment method's identifying details.
 * Single source of truth for admin list views. Adding a new PaymentMethodType
 * in the future requires extending this switch — if the case is missing the
 * method falls back to '-', which is the bug that motivated extracting this.
 */
export function getPaymentMethodSummary(method: PaymentMethodConfig): string {
  switch (method.type) {
    case PaymentMethodType.PAGO_MOVIL:
      return method.pagoMovil
        ? `${method.pagoMovil.phoneNumber} - ${method.pagoMovil.bankName}`
        : '-';
    case PaymentMethodType.TRANSFERENCIA:
      return method.transferencia
        ? `${method.transferencia.accountNumber} - ${method.transferencia.bankName}`
        : '-';
    case PaymentMethodType.ZELLE: {
      if (!method.zelle) return '-';
      const parts: string[] = [];
      if (method.zelle.phoneNumber) parts.push(method.zelle.phoneNumber);
      if (method.zelle.email) parts.push(method.zelle.email);
      return parts.length ? parts.join(' · ') : '-';
    }
    case PaymentMethodType.EFECTIVO_DIVISAS:
    case PaymentMethodType.TARJETA:
      return method.customMessage || 'Sin mensaje';
    default:
      return '-';
  }
}
