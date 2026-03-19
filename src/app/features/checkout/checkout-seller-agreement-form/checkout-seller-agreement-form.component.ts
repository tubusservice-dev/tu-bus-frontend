import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, SellerAgreementInfo } from '../services/checkout.service';

@Component({
  selector: 'app-checkout-seller-agreement-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './checkout-seller-agreement-form.component.html',
  styleUrl: './checkout-seller-agreement-form.component.scss',
})
export class CheckoutSellerAgreementFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected contactForm!: FormGroup;

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
  }

  private initForm(): void {
    const existing = this.checkoutService.sellerAgreementInfo();

    this.contactForm = this.fb.group({
      fullName: [existing?.fullName || '', [Validators.required, Validators.minLength(3)]],
      documentType: [existing?.documentType || 'V', Validators.required],
      documentNumber: [existing?.documentNumber || '', [Validators.required, Validators.minLength(6)]],
      phone: [existing?.phone || '', [Validators.required, Validators.minLength(10)]],
      email: [existing?.email || '', [Validators.email]],
      notes: [existing?.notes || '', [Validators.maxLength(500)]],
    });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
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
    if (control.errors['email']) return 'Correo electrónico inválido';

    return 'Campo inválido';
  }
}
