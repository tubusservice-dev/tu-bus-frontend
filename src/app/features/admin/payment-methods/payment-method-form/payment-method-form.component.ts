import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PaymentMethodService } from '../../../../core/services/payment-method.service';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  PaymentMethodType,
  PAYMENT_METHOD_TYPE_OPTIONS,
  PaymentMethodConfig,
} from '../../../../models/payment-method.model';

@Component({
  selector: 'app-payment-method-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './payment-method-form.component.html',
  styleUrl: './payment-method-form.component.scss',
})
export class PaymentMethodFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PaymentMethodService);
  private readonly toastService = inject(ToastService);

  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly methodId = signal<string | null>(null);

  protected readonly typeOptions = PAYMENT_METHOD_TYPE_OPTIONS;
  protected readonly selectedType = signal<PaymentMethodType | null>(null);

  protected form!: FormGroup;

  // Exponer enum al template
  protected readonly PaymentMethodType = PaymentMethodType;

  // Lista de bancos de Venezuela
  protected readonly venezuelanBanks: string[] = [
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

  ngOnInit(): void {
    this.initForm();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode.set(true);
      this.methodId.set(id);
      this.loadMethod(id);
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      type: ['', Validators.required],
      label: ['', [Validators.required, Validators.maxLength(100)]],
      isActive: [true],
      // Pago Móvil
      pm_phoneNumber: [''],
      pm_bankName: [''],
      pm_documentId: [''],
      // Transferencia
      tr_accountNumber: [''],
      tr_bankName: [''],
      tr_documentId: [''],
      // Mensaje personalizado (divisas / tarjeta)
      customMessage: [''],
    });

    // Escuchar cambios de tipo
    this.form.get('type')?.valueChanges.subscribe((type: PaymentMethodType) => {
      this.selectedType.set(type);
      this.updateValidators(type);
    });
  }

  private updateValidators(type: PaymentMethodType): void {
    // Limpiar todos los validadores específicos
    const pmFields = ['pm_phoneNumber', 'pm_bankName', 'pm_documentId'];
    const trFields = ['tr_accountNumber', 'tr_bankName', 'tr_documentId'];

    [...pmFields, ...trFields, 'customMessage'].forEach((field) => {
      this.form.get(field)?.clearValidators();
      this.form.get(field)?.updateValueAndValidity();
    });

    switch (type) {
      case PaymentMethodType.PAGO_MOVIL:
        pmFields.forEach((field) => {
          this.form.get(field)?.setValidators([Validators.required]);
          this.form.get(field)?.updateValueAndValidity();
        });
        break;
      case PaymentMethodType.TRANSFERENCIA:
        trFields.forEach((field) => {
          this.form.get(field)?.setValidators([Validators.required]);
          this.form.get(field)?.updateValueAndValidity();
        });
        break;
    }
  }

  private loadMethod(id: string): void {
    this.isLoading.set(true);
    this.service.getById(id).subscribe({
      next: (response) => {
        const method = response.data;
        this.selectedType.set(method.type);

        this.form.patchValue({
          type: method.type,
          label: method.label,
          isActive: method.isActive,
          customMessage: method.customMessage || '',
        });

        if (method.pagoMovil) {
          this.form.patchValue({
            pm_phoneNumber: method.pagoMovil.phoneNumber,
            pm_bankName: method.pagoMovil.bankName,
            pm_documentId: method.pagoMovil.documentId,
          });
        }

        if (method.transferencia) {
          this.form.patchValue({
            tr_accountNumber: method.transferencia.accountNumber,
            tr_bankName: method.transferencia.bankName,
            tr_documentId: method.transferencia.documentId,
          });
        }

        this.updateValidators(method.type);
        // Deshabilitar tipo en edición
        this.form.get('type')?.disable();
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Error al cargar el método de pago');
        this.isLoading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const rawValue = this.form.getRawValue();
    const type = rawValue.type as PaymentMethodType;

    const payload: any = {
      type,
      label: rawValue.label,
      isActive: rawValue.isActive,
    };

    switch (type) {
      case PaymentMethodType.PAGO_MOVIL:
        payload.pagoMovil = {
          phoneNumber: rawValue.pm_phoneNumber,
          bankName: rawValue.pm_bankName,
          documentId: rawValue.pm_documentId,
        };
        break;
      case PaymentMethodType.TRANSFERENCIA:
        payload.transferencia = {
          accountNumber: rawValue.tr_accountNumber,
          bankName: rawValue.tr_bankName,
          documentId: rawValue.tr_documentId,
        };
        break;
      case PaymentMethodType.EFECTIVO_DIVISAS:
      case PaymentMethodType.TARJETA:
        payload.customMessage = rawValue.customMessage;
        break;
    }

    const request$ = this.isEditMode()
      ? this.service.update(this.methodId()!, payload)
      : this.service.create(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.toastService.success(
          this.isEditMode()
            ? 'Método de pago actualizado exitosamente'
            : 'Método de pago creado exitosamente',
        );
        this.router.navigate(['/admin/payment-methods']);
      },
      error: (error) => {
        this.isSubmitting.set(false);
        const msg = error.error?.message || 'Error al guardar';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/admin/payment-methods']);
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }
}
