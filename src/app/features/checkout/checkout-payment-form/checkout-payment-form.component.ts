import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { UploadService } from '../../../core/services/upload.service';
import { CreatePaymentRequest, PaymentMethod } from '../../../models/payment.model';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';

@Component({
  selector: 'app-checkout-payment-form',
  standalone: true,
  imports: [ReactiveFormsModule, DateInputComponent],
  template: `
    <div class="payment-form-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="page-title">
            <h1>Detalles del Pago</h1>
            <p class="page-subtitle">Ingresa los datos de tu transferencia o pago móvil</p>
          </div>
        </div>
      </div>

      <!-- Contenido -->
      <div class="page-content">
        <div class="form-container">
          <form [formGroup]="paymentForm" (ngSubmit)="onSubmit()">
            <!-- Número de referencia -->
            <div class="form-group">
              <label for="referenceNumber" class="form-label">Número de referencia</label>
              <input
                type="text"
                id="referenceNumber"
                formControlName="referenceNumber"
                class="form-input"
                placeholder="Ej: 00001234567890"
              />
              @if (paymentForm.get('referenceNumber')?.touched && paymentForm.get('referenceNumber')?.hasError('required')) {
                <span class="form-error">El número de referencia es requerido</span>
              }
            </div>

            <!-- Monto de la transacción -->
            <div class="form-group">
              <label for="transactionAmount" class="form-label">Monto de la transacción</label>
              <input
                type="number"
                id="transactionAmount"
                formControlName="transactionAmount"
                class="form-input"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              @if (paymentForm.get('transactionAmount')?.touched && paymentForm.get('transactionAmount')?.hasError('required')) {
                <span class="form-error">El monto es requerido</span>
              }
            </div>

            <!-- Fecha del pago -->
            <div class="form-group">
              <label for="paymentDate" class="form-label">Fecha del pago <span class="required">*</span></label>
              <app-date-input
                id="paymentDate"
                formControlName="paymentDate"
                [max]="todayStr"
                [required]="true"
              />
              @if (paymentForm.get('paymentDate')?.touched && paymentForm.get('paymentDate')?.hasError('required')) {
                <span class="form-error">La fecha de pago es requerida</span>
              }
              @if (paymentForm.get('paymentDate')?.touched && paymentForm.get('paymentDate')?.hasError('futureDate')) {
                <span class="form-error">La fecha no puede ser futura</span>
              }
            </div>

            <!-- Captura / Comprobante -->
            <div class="form-group">
              <label class="form-label">Captura / Comprobante (opcional)</label>
              <div class="file-upload-area" (click)="fileInput.click()">
                @if (uploadedImageUrl()) {
                  <div class="uploaded-preview">
                    <img [src]="uploadedImageUrl()" alt="Comprobante" class="preview-image" />
                    <button type="button" class="remove-btn" (click)="removeImage($event)">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                } @else if (isUploading()) {
                  <div class="upload-loading">
                    <span class="spinner-sm"></span>
                    <span>Subiendo imagen...</span>
                  </div>
                } @else {
                  <div class="upload-placeholder">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <span>Haz clic para subir tu comprobante</span>
                    <span class="upload-hint">JPG, PNG o PDF</span>
                  </div>
                }
              </div>
              <input
                #fileInput
                type="file"
                accept="image/*,.pdf"
                class="hidden"
                (change)="onFileSelected($event)"
              />
            </div>

            <!-- Error -->
            @if (errorMessage()) {
              <div class="error-alert">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <!-- Botón enviar -->
            <div class="form-actions">
              <button
                type="submit"
                class="btn-submit"
                [disabled]="paymentForm.invalid || isSubmitting() || isUploading()"
              >
                @if (isSubmitting()) {
                  <span class="spinner-sm"></span>
                  Enviando pago...
                } @else {
                  Confirmar Pago
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styleUrl: './checkout-payment-form.component.scss',
})
export class CheckoutPaymentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly paymentService = inject(PaymentService);
  private readonly uploadService = inject(UploadService);

  protected readonly todayStr = new Date().toISOString().split('T')[0];
  protected readonly isSubmitting = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly uploadedImageUrl = signal<string | null>(null);
  private uploadedPublicId: string | null = null;

  private orderId = '';

  protected readonly paymentForm = this.fb.group({
    referenceNumber: ['', Validators.required],
    transactionAmount: [null as number | null, Validators.required],
    paymentDate: ['', [Validators.required, this.notFutureDateValidator]],
  });

  private notFutureDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const selected = new Date(control.value + 'T23:59:59');
    if (selected > new Date()) return { futureDate: true };
    return null;
  }

  ngOnInit(): void {
    this.orderId = this.route.snapshot.params['orderId'];
    if (!this.orderId) {
      this.router.navigate(['/carrito']);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isUploading.set(true);
    this.errorMessage.set(null);

    this.uploadService.uploadImage(file, 'payments').subscribe({
      next: (response) => {
        this.uploadedImageUrl.set(response.data.url);
        this.uploadedPublicId = response.data.publicId;
        this.isUploading.set(false);
      },
      error: (err) => {
        this.isUploading.set(false);
        this.errorMessage.set(err.error?.message || 'Error al subir la imagen');
      },
    });

    // Reset file input
    input.value = '';
  }

  removeImage(event: Event): void {
    event.stopPropagation();
    this.uploadedImageUrl.set(null);
    this.uploadedPublicId = null;
  }

  onSubmit(): void {
    if (this.paymentForm.invalid) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.paymentForm.getRawValue();

    const paymentData: CreatePaymentRequest = {
      orderId: this.orderId,
      method: PaymentMethod.DIGITAL,
      referenceNumber: formValue.referenceNumber!,
      transactionAmount: formValue.transactionAmount!,
      paymentDate: formValue.paymentDate!,
      ...(this.uploadedImageUrl() ? { captureUrl: this.uploadedImageUrl()! } : {}),
      ...(this.uploadedPublicId ? { capturePublicId: this.uploadedPublicId } : {}),
    };

    this.paymentService.createPayment(paymentData).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/checkout/confirmacion', this.orderId]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message || 'Error al registrar el pago');
      },
    });
  }
}
