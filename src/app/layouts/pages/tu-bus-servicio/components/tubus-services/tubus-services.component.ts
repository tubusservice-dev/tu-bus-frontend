import { Component } from '@angular/core';
import { SERVICES } from '../../data/mock-data';

@Component({
  selector: 'app-tubus-services',
  standalone: true,
  imports: [],
  templateUrl: './tubus-services.component.html',
  styleUrl: './tubus-services.component.scss'
})
export class TubusServicesComponent {
  protected readonly services = SERVICES;
}
