import { Component, inject, computed } from '@angular/core';
import { EXTERNAL_LINK, IExternalLink } from '@platform';
import { SettingsService } from '../../../../../core/services/settings.service';
import { LocationService, BranchSummary } from '../../../../../core/services/location.service';

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
  private readonly externalLink = inject<IExternalLink>(EXTERNAL_LINK);

  protected readonly whatsappConfig = this.settingsService.whatsappConfig;
  protected readonly customerSupport = this.settingsService.customerSupportConfig;

  protected readonly branches = computed(() => this.locationService.branches());
  protected readonly hasMultipleBranches = computed(() => this.branches().length > 1);

  // Single-branch quick accessors (only meaningful when branches.length === 1).
  private readonly firstBranch = computed<BranchSummary | null>(() => this.branches()[0] ?? null);
  protected readonly phone = computed(() => this.firstBranch()?.whatsappPhone || '');
  protected readonly address = computed(() => this.firstBranch()?.address || '');
  protected readonly schedule = computed(() => this.formatSchedule(this.firstBranch()));

  /**
   * WhatsApp button visibility — driven by the customer-support setting,
   * with a transitional fallback to the global whatsapp config so the CTA
   * does not break before the admin configures the new namespace.
   */
  protected readonly whatsappEnabled = computed(() => {
    const cs = this.customerSupport();
    if (cs.whatsapp.trim().length > 0) return true;
    return this.whatsappConfig().isEnabled && this.whatsappConfig().phoneNumber.trim().length > 0;
  });

  protected formatSchedule(branch: BranchSummary | null): string {
    if (!branch?.schedule?.length) return '';

    const open = branch.schedule.filter(d => !d.isClosed);
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
  }

  private formatTime(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }

  openWhatsApp(): void {
    // Customer-support number takes priority; fall back to the global setting
    // so the CTA stays functional during the admin transition window.
    const raw = this.customerSupport().whatsapp || this.whatsappConfig().phoneNumber;
    if (!raw) return;
    const digits = raw.replace(/\D/g, '');
    const international = digits.startsWith('0') ? '58' + digits.substring(1) : digits;
    const message = encodeURIComponent('Hola, me interesa información sobre sus servicios de cambio de aceite.');
    void this.externalLink.open(`https://wa.me/${international}?text=${message}`, '_blank');
  }

  callPhone(phoneNumber?: string): void {
    const target = phoneNumber ?? this.phone();
    if (target) {
      void this.externalLink.open(`tel:${target}`, '_self');
    }
  }
}
