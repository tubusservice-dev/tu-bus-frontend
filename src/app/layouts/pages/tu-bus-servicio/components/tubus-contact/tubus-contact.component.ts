import { Component, inject, computed } from '@angular/core';
import { SettingsService } from '../../../../../core/services/settings.service';
import { LocationService } from '../../../../../core/services/location.service';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

@Component({
  selector: 'app-tubus-contact',
  standalone: true,
  imports: [],
  templateUrl: './tubus-contact.component.html',
  styleUrl: './tubus-contact.component.scss'
})
export class TubusContactComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly locationService = inject(LocationService);

  protected readonly whatsappConfig = this.settingsService.whatsappConfig;

  private readonly branch = computed(() => this.locationService.branches()[0] ?? null);

  protected readonly phone = computed(() => this.branch()?.whatsappPhone || '');
  protected readonly address = computed(() => this.branch()?.address || '');
  protected readonly branchName = computed(() => this.branch()?.name || '');
  protected readonly whatsappNumber = computed(() => this.whatsappConfig().phoneNumber);
  protected readonly whatsappEnabled = computed(() => this.whatsappConfig().isEnabled);

  protected readonly schedule = computed(() => {
    const b = this.branch();
    if (!b?.schedule?.length) return '';

    const open = b.schedule.filter(d => !d.isClosed);
    if (open.length === 0) return '';

    // Group consecutive days with same hours
    const groups: { days: string[]; hours: string }[] = [];
    for (const day of open) {
      const hours = `${this.formatTime(day.openTime)} - ${this.formatTime(day.closeTime)}`;
      const last = groups[groups.length - 1];
      if (last && last.hours === hours) {
        last.days.push(DAY_NAMES[day.day]);
      } else {
        groups.push({ days: [DAY_NAMES[day.day]], hours });
      }
    }

    return groups
      .map(g => {
        const dayRange = g.days.length > 1
          ? `${g.days[0]} a ${g.days[g.days.length - 1]}`
          : g.days[0];
        return `${dayRange}: ${g.hours}`;
      })
      .join(' | ');
  });

  private formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  openWhatsApp(): void {
    // Use branch whatsapp phone, fallback to global config
    const raw = this.phone() || this.whatsappNumber();
    if (!raw) return;
    // Convert 0412-0263111 or 04120263111 → 584120263111
    const digits = raw.replace(/\D/g, '');
    const international = digits.startsWith('0') ? '58' + digits.substring(1) : digits;
    const message = encodeURIComponent('Hola, me interesa información sobre sus servicios de cambio de aceite.');
    window.open(`https://wa.me/${international}?text=${message}`, '_blank');
  }

  callPhone(): void {
    const phoneNumber = this.phone();
    if (phoneNumber) {
      window.open(`tel:${phoneNumber}`, '_self');
    }
  }
}
