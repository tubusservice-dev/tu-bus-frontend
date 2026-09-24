import { Component, inject, signal } from '@angular/core';
import { LocationStore } from '@core/services/location-store.service';
import { LocationChangePlan, LocationChangeService } from '@core/services/location-change.service';
import { ZoneSelectorService } from '@core/services/zone-selector.service';
import { ToastService } from '@shared/services/toast.service';
import { ZoningModalComponent, ZonePick } from '../zoning-modal/zoning-modal.component';
import { dismissOnBack } from '@core/services/back-dismiss.service';

/**
 * The zone selector and its cart confirmation, hosted once at the root.
 *
 * A pick is checked against the cart first: only when some items are not
 * carried by the new zone's branches does the customer have to confirm, and
 * then only those items leave the cart.
 */
@Component({
  selector: 'app-zone-selector-host',
  standalone: true,
  imports: [ZoningModalComponent],
  templateUrl: './zone-selector-host.component.html',
  styleUrl: './zone-selector-host.component.scss',
})
export class ZoneSelectorHostComponent {
  protected readonly selector = inject(ZoneSelectorService);
  protected readonly locationStore = inject(LocationStore);
  private readonly locationChange = inject(LocationChangeService);
  private readonly toastService = inject(ToastService);

  constructor() {
    // The Android back button closes this modal like its ✕ does.
    dismissOnBack(() => this.pending() !== null, () => this.cancel());
  }

  /** The picked place is being checked against the cart. */
  protected readonly busy = signal(false);
  /** A change that would remove items from the cart, waiting for the customer's answer. */
  protected readonly pending = signal<LocationChangePlan | null>(null);

  protected onPicked(pick: ZonePick): void {
    this.busy.set(true);
    this.locationChange.prepare(pick.state, pick.municipality).subscribe({
      next: (plan) => {
        this.busy.set(false);
        this.selector.close();
        if (plan.unavailable.length) this.pending.set(plan);
        else this.locationChange.apply(plan);
      },
      error: () => {
        this.busy.set(false);
        this.toastService.error('No pudimos comprobar esa zona. Intenta de nuevo.');
      },
    });
  }

  protected confirm(): void {
    const plan = this.pending();
    if (plan) this.locationChange.apply(plan);
    this.pending.set(null);
  }

  /** Keeps the current place and the whole cart. */
  protected cancel(): void {
    this.pending.set(null);
  }

  /** "Ahora no, solo quiero explorar", or "Quitar mi ubicación": the whole store, no location. */
  protected onExplore(): void {
    this.selector.close();
    this.locationStore.browseWithoutLocation();
  }

  /** Closing without a pick keeps any place already set; with none, it means exploring. */
  protected onClosed(): void {
    this.selector.close();
    if (this.locationStore.status() === 'undecided') this.locationStore.browseWithoutLocation();
  }
}
