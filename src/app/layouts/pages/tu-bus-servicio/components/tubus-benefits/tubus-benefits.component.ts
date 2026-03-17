import { Component } from '@angular/core';
import { BENEFITS } from '../../data/mock-data';

@Component({
  selector: 'app-tubus-benefits',
  standalone: true,
  imports: [],
  templateUrl: './tubus-benefits.component.html',
  styleUrl: './tubus-benefits.component.scss'
})
export class TubusBenefitsComponent {
  protected readonly benefits = BENEFITS;
}
