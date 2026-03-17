import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TubusHeaderComponent } from '../../pages/tu-bus-servicio/components/tubus-header/tubus-header.component';
import { FooterComponent } from '../footer/footer.component';
import { ZoningModalComponent } from '../../../shared/components';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, TubusHeaderComponent, FooterComponent, ZoningModalComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss'
})
export class MainLayoutComponent {}