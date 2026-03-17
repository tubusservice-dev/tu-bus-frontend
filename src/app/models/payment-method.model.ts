export enum PaymentMethodType {
  PAGO_MOVIL = 'pago_movil',
  TRANSFERENCIA = 'transferencia',
  EFECTIVO_DIVISAS = 'efectivo_divisas',
  TARJETA = 'tarjeta',
}

export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  [PaymentMethodType.PAGO_MOVIL]: 'Pago Móvil',
  [PaymentMethodType.TRANSFERENCIA]: 'Transferencia Bancaria',
  [PaymentMethodType.EFECTIVO_DIVISAS]: 'Efectivo en Divisas',
  [PaymentMethodType.TARJETA]: 'Pago con Tarjeta',
};

export const PAYMENT_METHOD_TYPE_OPTIONS = [
  { value: PaymentMethodType.PAGO_MOVIL, label: 'Pago Móvil' },
  { value: PaymentMethodType.TRANSFERENCIA, label: 'Transferencia Bancaria' },
  { value: PaymentMethodType.EFECTIVO_DIVISAS, label: 'Efectivo en Divisas' },
  { value: PaymentMethodType.TARJETA, label: 'Pago con Tarjeta' },
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

export interface PaymentMethodConfig {
  id: string;
  type: PaymentMethodType;
  label: string;
  isActive: boolean;
  pagoMovil?: PagoMovilDetails;
  transferencia?: TransferenciaDetails;
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
  customMessage?: string;
  sortOrder?: number;
}

export interface UpdatePaymentMethodDto {
  label?: string;
  isActive?: boolean;
  pagoMovil?: PagoMovilDetails;
  transferencia?: TransferenciaDetails;
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
};

/** Tipos que requieren formulario de pago (referencia, banco, monto, fecha) */
export const PAYMENT_TYPES_WITH_FORM: PaymentMethodType[] = [
  PaymentMethodType.PAGO_MOVIL,
  PaymentMethodType.TRANSFERENCIA,
];

/** Tipos que solo muestran mensaje informativo */
export const PAYMENT_TYPES_INFO_ONLY: PaymentMethodType[] = [
  PaymentMethodType.EFECTIVO_DIVISAS,
  PaymentMethodType.TARJETA,
];
