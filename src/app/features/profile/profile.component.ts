import { Component, inject, signal, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core';
import { ProfileInfoComponent } from './profile-info/profile-info.component';
import { GarageComponent } from '../garage/garage.component';
import { OrderListComponent } from '../orders/order-list/order-list.component';
import { NotificationsListComponent } from './components/notifications-list/notifications-list.component';

type ProfileTab = 'profile' | 'garage' | 'orders' | 'payments' | 'notifications';

const FRAGMENT_TAB_MAP: Record<string, ProfileTab> = {
  'pedidos': 'orders',
  'orders': 'orders',
  'garaje': 'garage',
  'garage': 'garage',
  'pagos': 'payments',
  'payments': 'payments',
  'notificaciones': 'notifications',
  'notifications': 'notifications',
};

const TAB_FRAGMENT_MAP: Record<ProfileTab, string | null> = {
  profile: null,
  garage: 'garaje',
  orders: 'pedidos',
  payments: 'pagos',
  notifications: 'notificaciones',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ProfileInfoComponent, GarageComponent, OrderListComponent, NotificationsListComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = this.authService.currentUser;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly activeTab = signal<ProfileTab>('profile');

  ngOnInit(): void {
    // Listen to fragment changes reactively (menu navigation, direct URL, tab clicks)
    this.route.fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => {
        if (fragment && FRAGMENT_TAB_MAP[fragment]) {
          this.activeTab.set(FRAGMENT_TAB_MAP[fragment]);
        } else {
          this.activeTab.set('profile');
        }
      });
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    const fragment = TAB_FRAGMENT_MAP[tab];
    this.router.navigate(['/perfil'], { fragment: fragment ?? undefined, replaceUrl: true });
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const name = `${this.user()?.firstName || ''} ${this.user()?.lastName || ''}`.trim();
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  }
}