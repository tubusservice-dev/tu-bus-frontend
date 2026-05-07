import { Component, inject, signal, OnInit, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '@core/services';
import { ProfileInfoComponent } from './profile-info/profile-info.component';
import { GarageComponent } from '@features/garage/garage.component';
import { OrderListComponent } from '@features/orders/order-list/order-list.component';
import { NotificationsListComponent } from './components/notifications-list/notifications-list.component';
import { CompleteProfileModalComponent } from '@shared/components/complete-profile-modal/complete-profile-modal.component';

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
  imports: [
    CommonModule,
    ProfileInfoComponent,
    GarageComponent,
    OrderListComponent,
    NotificationsListComponent,
    CompleteProfileModalComponent,
  ],
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

  /**
   * True when the auth-system v2 migration left the user with missing
   * personal data (typical for OAuth-only registrations). Drives the
   * persistent banner and the auto-opened modal.
   */
  protected readonly profileIncomplete = computed(() => {
    const u = this.user();
    return !!u && u.profileCompleted === false;
  });

  protected readonly showCompleteProfileModal = signal(false);

  ngOnInit(): void {
    this.route.fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => {
        if (fragment && FRAGMENT_TAB_MAP[fragment]) {
          this.activeTab.set(FRAGMENT_TAB_MAP[fragment]);
        } else {
          this.activeTab.set('profile');
        }
      });

    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        if (params.get('completeProfile') === 'true' && this.profileIncomplete()) {
          this.showCompleteProfileModal.set(true);
        }
      });
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
    const fragment = TAB_FRAGMENT_MAP[tab];
    this.router.navigate(['/perfil'], { fragment: fragment ?? undefined, replaceUrl: true });
  }

  openCompleteProfileModal(): void {
    this.showCompleteProfileModal.set(true);
  }

  closeCompleteProfileModal(): void {
    this.showCompleteProfileModal.set(false);
    // Strip the query param so reloads do not re-open the modal.
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { completeProfile: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const name = `${this.user()?.firstName || ''} ${this.user()?.lastName || ''}`.trim();
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  }
}
