import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-tubus-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './tubus-footer.component.html',
  styleUrl: './tubus-footer.component.scss'
})
export class TubusFooterComponent {
  protected readonly currentYear = new Date().getFullYear();
}
