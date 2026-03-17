import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, ShippingRecipientInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';

interface VenezuelanState {
  code: string;
  name: string;
}

@Component({
  selector: 'app-checkout-shipping-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './checkout-shipping-form.component.html',
  styleUrl: './checkout-shipping-form.component.scss',
})
export class CheckoutShippingFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** Formulario de datos de envío */
  protected shippingForm!: FormGroup;

  /** Agencia seleccionada */
  protected readonly selectedAgency = this.checkoutService.selectedShippingAgency;

  /** Estados de Venezuela */
  protected readonly states: VenezuelanState[] = [
    { code: 'AMZ', name: 'Amazonas' },
    { code: 'ANZ', name: 'Anzoátegui' },
    { code: 'APU', name: 'Apure' },
    { code: 'ARA', name: 'Aragua' },
    { code: 'BAR', name: 'Barinas' },
    { code: 'BOL', name: 'Bolívar' },
    { code: 'CAR', name: 'Carabobo' },
    { code: 'COJ', name: 'Cojedes' },
    { code: 'DAM', name: 'Delta Amacuro' },
    { code: 'DIC', name: 'Distrito Capital' },
    { code: 'FAL', name: 'Falcón' },
    { code: 'GUA', name: 'Guárico' },
    { code: 'LAR', name: 'Lara' },
    { code: 'MER', name: 'Mérida' },
    { code: 'MIR', name: 'Miranda' },
    { code: 'MON', name: 'Monagas' },
    { code: 'NES', name: 'Nueva Esparta' },
    { code: 'POR', name: 'Portuguesa' },
    { code: 'SUC', name: 'Sucre' },
    { code: 'TAC', name: 'Táchira' },
    { code: 'TRU', name: 'Trujillo' },
    { code: 'VAR', name: 'Vargas (La Guaira)' },
    { code: 'YAR', name: 'Yaracuy' },
    { code: 'ZUL', name: 'Zulia' },
  ];

  /** Tipos de documento */
  protected readonly documentTypes = [
    { code: 'V', name: 'V - Venezolano' },
    { code: 'E', name: 'E - Extranjero' },
    { code: 'J', name: 'J - Jurídico' },
    { code: 'P', name: 'P - Pasaporte' },
  ];

  ngOnInit(): void {
    // Redirigir si no hay agencia seleccionada
    if (!this.selectedAgency()) {
      this.router.navigate(['/checkout/agencia']);
      return;
    }

    this.initForm();
    this.loadSavedData();
  }

  /**
   * Inicializar formulario
   */
  private initForm(): void {
    this.shippingForm = this.fb.group({
      // Datos del destinatario
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(/^\d{6,10}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      alternativePhone: ['', [Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      email: ['', [Validators.email]],

      // Dirección de envío
      state: ['', Validators.required],
      city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      referencePoint: ['', Validators.maxLength(200)],

      // Datos de la agencia (opcional)
      agencyOfficeCode: ['', Validators.maxLength(50)],

      // Notas adicionales
      notes: ['', Validators.maxLength(500)],
    });
  }

  /**
   * Cargar datos guardados previamente
   */
  private loadSavedData(): void {
    const savedInfo = this.checkoutService.shippingRecipientInfo();
    if (savedInfo) {
      this.shippingForm.patchValue(savedInfo);
    }
  }

  /**
   * Continuar al resumen
   */
  onSubmit(): void {
    if (this.shippingForm.invalid) {
      this.shippingForm.markAllAsTouched();
      return;
    }

    const formValue = this.shippingForm.value;
    const shippingInfo: ShippingRecipientInfo = {
      fullName: formValue.fullName.trim(),
      documentType: formValue.documentType,
      documentNumber: formValue.documentNumber,
      phone: formValue.phone,
      alternativePhone: formValue.alternativePhone || undefined,
      email: formValue.email || undefined,
      state: formValue.state,
      city: formValue.city.trim(),
      address: formValue.address.trim(),
      referencePoint: formValue.referencePoint?.trim() || undefined,
      agencyOfficeCode: formValue.agencyOfficeCode?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
    };

    this.checkoutService.setShippingRecipientInfo(shippingInfo);
    this.router.navigate(['/checkout/resumen']);
  }

  /**
   * Volver a selección de agencia
   */
  goBack(): void {
    this.router.navigate(['/checkout/agencia']);
  }

  /**
   * Obtener nombre del estado seleccionado
   */
  getStateName(code: string): string {
    return this.states.find((s) => s.code === code)?.name || code;
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(field: string): boolean {
    const control = this.shippingForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getErrorMessage(field: string): string {
    const control = this.shippingForm.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    if (control.errors['maxlength']) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    }
    if (control.errors['pattern']) {
      if (field === 'documentNumber') return 'Ingresa un número de documento válido (6-10 dígitos)';
      if (field === 'phone' || field === 'alternativePhone') {
        return 'Formato: 04XX-XXXXXXX';
      }
    }
    if (control.errors['email']) return 'Ingresa un email válido';

    return 'Campo inválido';
  }
}
