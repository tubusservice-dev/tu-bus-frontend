import { Component, inject, computed } from '@angular/core';
import { SettingsService } from '../../../../../core/services/settings.service';

@Component({
  selector: 'app-tubus-contact',
  standalone: true,
  imports: [],
  templateUrl: './tubus-contact.component.html',
  styleUrl: './tubus-contact.component.scss'
})
export class TubusContactComponent {
  private readonly settingsService = inject(SettingsService);

  // Configuraciones del admin
  protected readonly whatsappConfig = this.settingsService.whatsappConfig;
  protected readonly dispatchConfig = this.settingsService.dispatchConfig;

  // Computed para datos de contacto
  protected readonly phone = computed(() => this.dispatchConfig().storePickup.phone);
  protected readonly schedule = computed(() => this.dispatchConfig().storePickup.schedule);
  protected readonly address = computed(() => this.dispatchConfig().storePickup.address);
  protected readonly whatsappNumber = computed(() => this.whatsappConfig().phoneNumber);
  protected readonly whatsappEnabled = computed(() => this.whatsappConfig().isEnabled);

  openWhatsApp(): void {
    if (!this.whatsappEnabled()) return;

    const message = encodeURIComponent('Hola, me interesa información sobre sus servicios de cambio de aceite.');
    window.open(`https://wa.me/${this.whatsappNumber()}?text=${message}`, '_blank');
  }

  callPhone(): void {
    const phoneNumber = this.phone();
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, '_self');
    }
  }
}
