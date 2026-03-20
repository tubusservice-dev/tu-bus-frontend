import { Component, computed, inject } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
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
export class MainLayoutComponent {
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  /** true when the route is cart or any checkout step */
  protected readonly isCheckoutFlow = computed(() => {
    const url = this.currentUrl();
    return url.startsWith('/carrito') || url.startsWith('/checkout');
  });
}
