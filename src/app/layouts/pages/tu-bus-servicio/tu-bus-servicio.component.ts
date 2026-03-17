import { Component } from '@angular/core';
import { TubusHeaderComponent } from './components/tubus-header/tubus-header.component';
import { TubusHeroComponent } from './components/tubus-hero/tubus-hero.component';
import { TubusServicesComponent } from './components/tubus-services/tubus-services.component';
import { TubusCombosComponent } from './components/tubus-combos/tubus-combos.component';
import { TubusBrandsComponent } from './components/tubus-brands/tubus-brands.component';
import { TubusBenefitsComponent } from './components/tubus-benefits/tubus-benefits.component';
import { TubusContactComponent } from './components/tubus-contact/tubus-contact.component';
import { TubusFooterComponent } from './components/tubus-footer/tubus-footer.component';
import { ZoningModalComponent } from '../../../shared/components';

@Component({
  selector: 'app-tu-bus-servicio',
  standalone: true,
  imports: [
    TubusHeaderComponent,
    TubusHeroComponent,
    TubusServicesComponent,
    TubusCombosComponent,
    TubusBrandsComponent,
    TubusBenefitsComponent,
    TubusContactComponent,
    TubusFooterComponent,
    ZoningModalComponent,
  ],
  templateUrl: './tu-bus-servicio.component.html',
  styleUrl: './tu-bus-servicio.component.scss'
})
export class TuBusServicioComponent {}
