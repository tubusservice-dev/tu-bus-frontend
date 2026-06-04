import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, SellerAgreementInfo } from '../services/checkout.service';
import { AuthService } from '@core/services/auth.service';
import { scrollToFirstFormError } from '@shared/validators/form-validators';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';
import { PhoneMaskDirective } from '@shared/directives/phone-mask.directive';
import { ANALYTICS, AnalyticsEvent } from '@platform';

@Component({
  selector: 'app-checkout-seller-agreement-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CheckoutHeaderComponent, PhoneMaskDirective],
  templateUrl: './checkout-seller-agreement-form.component.html',
  styleUrl: './checkout-seller-agreement-form.component.scss',
})
export class CheckoutSellerAgreementFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS);

  protected contactForm!: FormGroup;
  protected readonly lockedFields = signal<Record<string, boolean>>({});

  protected readonly documentTypes = [
    { code: 'V', name: 'V' },
    { code: 'E', name: 'E' },
    { code: 'J', name: 'J' },
    { code: 'P', name: 'P' },
  ];

  ngOnInit(): void {
    if (this.checkoutService.dispatchType() !== 'seller_agreement') {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    this.initForm();
    this.loadSavedData();
  }

  private initForm(): void {
    this.contactForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(/^\d{6,10}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^(0414|0424|0412|0416|0426)-?\d{7}$/)]],
      email: ['', [Validators.email]],
      notes: ['', [Validators.maxLength(500)]],
    });
  }

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.sellerAgreementInfo();
    if (savedInfo) {
      this.contactForm.patchValue({
        fullName: savedInfo.fullName || '',
        documentType: savedInfo.documentType || 'V',
        documentNumber: savedInfo.documentNumber || '',
        phone: savedInfo.phone || '',
        email: savedInfo.email || '',
        notes: savedInfo.notes || '',
      });
    } else {
      this.authService.loadUserProfile().subscribe({
        next: () => this.prefillFromUserProfile(),
        error: () => this.prefillFromUserProfile(),
      });
    }
  }

  private prefillFromUserProfile(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const locked: Record<string, boolean> = {};
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

    if (fullName) {
      this.contactForm.patchValue({ fullName });
      this.contactForm.get('fullName')?.disable();
      locked['fullName'] = true;
    }
    if (user.documentType) {
      this.contactForm.patchValue({ documentType: user.documentType });
      this.contactForm.get('documentType')?.disable();
      locked['documentType'] = true;
    }
    if (user.documentNumber) {
      this.contactForm.patchValue({ documentNumber: user.documentNumber });
      this.contactForm.get('documentNumber')?.disable();
      locked['documentNumber'] = true;
    }
    if (user.phone) {
      this.contactForm.patchValue({ phone: user.phone });
      this.contactForm.get('phone')?.disable();
      locked['phone'] = true;
    }
    if (user.email) {
      this.contactForm.patchValue({ email: user.email });
      this.contactForm.get('email')?.disable();
      locked['email'] = true;
    }

    this.lockedFields.set(locked);
  }

  // ==================== LOCK / UNLOCK / CLEAR ====================

  protected readonly hasLockedFields = computed(() => {
    const locked = this.lockedFields();
    return ['fullName', 'documentType', 'documentNumber', 'phone', 'email'].some(f => locked[f]);
  });

  protected unlockPersonalFields(): void {
    const fields = ['fullName', 'documentType', 'documentNumber', 'phone', 'email'];
    fields.forEach(field => this.contactForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  protected clearPersonalFields(): void {
    this.contactForm.patchValue({
      fullName: '',
      documentType: 'V',
      documentNumber: '',
      phone: '',
      email: '',
    });
  }

  // ==================== FORM SUBMISSION ====================

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      void this.analytics.logEvent(AnalyticsEvent.FormError, { screen: 'checkout_seller_agreement' });
      scrollToFirstFormError();
      return;
    }

    const formValue = this.contactForm.getRawValue();
    const info: SellerAgreementInfo = {
      fullName: formValue.fullName.trim(),
      documentType: formValue.documentType,
      documentNumber: formValue.documentNumber.trim(),
      phone: formValue.phone.trim(),
      email: formValue.email?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
    };

    this.checkoutService.setSellerAgreementInfo(info);
    this.router.navigate(['/checkout/resumen']);
  }

  goBack(): void {
    this.router.navigate(['/checkout/despacho']);
  }

  hasError(field: string): boolean {
    const control = this.contactForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  getErrorMessage(field: string): string {
    const control = this.contactForm.get(field);
    if (!control?.errors) return '';

    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    if (control.errors['pattern']) {
      if (field === 'phone') return 'Formato: 04XX-XXXXXXX';
      if (field === 'documentNumber') return 'Solo dígitos, entre 6 y 10 caracteres';
    }
    if (control.errors['email']) return 'Correo electrónico inválido';

    return 'Campo inválido';
  }
}
