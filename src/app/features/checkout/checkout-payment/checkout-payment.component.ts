import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CheckoutService } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-checkout-payment',
  standalone: true,
  imports: [],
  template: `
    <div class="payment-page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-content">
          <button type="button" class="back-btn" (click)="goBack()">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span class="back-text">Volver</span>
          </button>
          <div class="page-title">
            <h1>Método de Pago</h1>
          </div>
        </div>
      </div>

      <!-- Contenido -->
      <div class="page-content">
        <div class="payment-container">
          <!-- Pregunta principal -->
          <div class="payment-question">
            <h2>¿Cómo deseas pagar?</h2>
            <p>Selecciona el método de pago que prefieras</p>
          </div>

          <!-- Grid de opciones -->
          <div class="payment-grid">
            <!-- Digital -->
            <button
              type="button"
              class="payment-card"
              [class.selected]="selectedMethod() === 'digital'"
              (click)="selectMethod('digital')"
            >
              <div class="card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
                </svg>
              </div>
              <div class="card-content">
                <h3 class="card-title">Digital (Bs/Divisas)</h3>
                <p class="card-description">Pago móvil o transferencia bancaria. Sube tu comprobante.</p>
              </div>
              <div class="card-footer">
                <span class="method-badge digital">Disponible</span>
              </div>
              @if (selectedMethod() === 'digital') {
                <div class="selected-check">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              }
            </button>

            <!-- Efectivo -->
            <button
              type="button"
              class="payment-card"
              [class.selected]="selectedMethod() === 'cash'"
              (click)="selectMethod('cash')"
            >
              <div class="card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              </div>
              <div class="card-content">
                <h3 class="card-title">Efectivo</h3>
                <p class="card-description">Pago en efectivo al recibir.</p>
                <p class="card-warning">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  El técnico no maneja caja chica, favor tener monto exacto.
                </p>
              </div>
              <div class="card-footer">
                <span class="method-badge cash">Disponible</span>
              </div>
              @if (selectedMethod() === 'cash') {
                <div class="selected-check">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              }
            </button>

            <!-- Cashea (disabled) -->
            <button
              type="button"
              class="payment-card disabled"
              disabled
            >
              <div class="card-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <div class="card-content">
                <h3 class="card-title">Cashea</h3>
                <p class="card-description">Paga en cuotas con Cashea.</p>
              </div>
              <div class="card-footer">
                <span class="coming-soon">Próximamente</span>
              </div>
            </button>
          </div>

          <!-- Botón continuar -->
          <div class="payment-actions">
            <button
              type="button"
              class="btn-continue"
              [disabled]="!checkoutService.hasPaymentMethod()"
              (click)="onContinue()"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './checkout-payment.component.scss',
})
export class CheckoutPaymentComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  protected readonly selectedMethod = this.checkoutService.paymentMethod;

  ngOnInit(): void {
    if (!this.checkoutService.hasDispatchType()) {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    if (this.cartService.isEmpty()) {
      this.router.navigate(['/carrito']);
      return;
    }
  }

  selectMethod(method: 'digital' | 'cash' | 'cashea'): void {
    this.checkoutService.selectPaymentMethod(method);
  }

  onContinue(): void {
    this.router.navigate(['/checkout/resumen']);
  }

  goBack(): void {
    const dispatchType = this.checkoutService.dispatchType();
    if (dispatchType === 'shipping_agency') {
      this.router.navigate(['/checkout/envio']);
    } else {
      this.router.navigate(['/checkout/despacho']);
    }
  }
}
