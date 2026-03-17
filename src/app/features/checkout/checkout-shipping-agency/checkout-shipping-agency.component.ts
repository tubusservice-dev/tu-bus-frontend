import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CheckoutService } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { ShippingAgencyService } from '../../../core/services/shipping-agency.service';
import { ShippingAgency } from '../../../models/product.model';

@Component({
  selector: 'app-checkout-shipping-agency',
  standalone: true,
  imports: [],
  templateUrl: './checkout-shipping-agency.component.html',
  styleUrl: './checkout-shipping-agency.component.scss',
})
export class CheckoutShippingAgencyComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly shippingAgencyService = inject(ShippingAgencyService);
  private readonly router = inject(Router);

  /** Lista de agencias de envío */
  protected readonly agencies = signal<ShippingAgency[]>([]);

  /** Estado de carga */
  protected readonly isLoading = signal(true);

  /** Error de carga */
  protected readonly error = signal<string | null>(null);

  /** Agencia seleccionada */
  protected readonly selectedAgency = this.checkoutService.selectedShippingAgency;

  ngOnInit(): void {
    this.loadAgencies();
  }

  /**
   * Cargar agencias de envío activas
   */
  protected loadAgencies(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.shippingAgencyService.getAll().subscribe({
      next: (response) => {
        this.agencies.set(response.data || []);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando agencias:', err);
        this.error.set('Error al cargar las agencias de envío');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Seleccionar una agencia
   */
  selectAgency(agency: ShippingAgency): void {
    this.checkoutService.selectShippingAgency(agency);
  }

  /**
   * Verificar si una agencia está seleccionada
   */
  isSelected(agency: ShippingAgency): boolean {
    return this.selectedAgency()?.id === agency.id;
  }

  /**
   * Obtener etiqueta de costo según configuración
   */
  getCostLabel(agency: ShippingAgency): string {
    if (agency.config.freeShipping) {
      return 'Envío Gratis';
    }
    if (agency.config.additionalCharge) {
      return `+$${agency.config.additionalChargeAmount.toFixed(2)}`;
    }
    return 'Pago en destino';
  }

  /**
   * Obtener clase CSS según tipo de costo
   */
  getCostClass(agency: ShippingAgency): string {
    if (agency.config.freeShipping) {
      return 'cost-free';
    }
    if (agency.config.additionalCharge) {
      return 'cost-extra';
    }
    return 'cost-destination';
  }

  /**
   * Continuar al formulario de datos de envío
   */
  onContinue(): void {
    if (this.selectedAgency()) {
      this.router.navigate(['/checkout/envio']);
    }
  }

  /**
   * Volver a selección de tipo de despacho
   */
  goBack(): void {
    this.checkoutService.clearShippingAgency();
    this.router.navigate(['/checkout/despacho']);
  }
}
