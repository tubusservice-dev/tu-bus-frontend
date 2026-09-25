import { Component, inject, input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';

type DispatchModule = 'storePickup' | 'shippingAgency' | 'localDelivery' | 'sellerAgreement';

/** "Módulos de Despacho" section: checkout delivery methods, saved per toggle. */
@Component({
  selector: 'app-dispatch-modules-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './dispatch-modules-settings.component.html',
  styleUrl: './dispatch-modules-settings.component.scss',
})
export class DispatchModulesSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly dispatchModulesForm = input.required<FormGroup>();

  protected saveDispatchModule(module: DispatchModule): void {
    const value = this.dispatchModulesForm().get(module)?.value;
    this.settingsService.updateDispatch({ modules: { [module]: value } }).subscribe();
  }
}
