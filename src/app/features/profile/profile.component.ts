import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core';
import { ProfileInfoComponent } from './profile-info/profile-info.component';
import { GarageComponent } from '../garage/garage.component';
import { OrderListComponent } from '../orders/order-list/order-list.component';
// import { PaymentHistoryComponent } from './components/payment-history/payment-history.component';

type ProfileTab = 'profile' | 'garage' | 'orders' | 'payments';

const FRAGMENT_TAB_MAP: Record<string, ProfileTab> = {
  'pedidos': 'orders',
  'orders': 'orders',
  'garaje': 'garage',
  'garage': 'garage',
  'pagos': 'payments',
  'payments': 'payments',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ProfileInfoComponent, GarageComponent, OrderListComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly user = this.authService.currentUser;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly activeTab = signal<ProfileTab>('profile');

  ngOnInit(): void {
    const fragment = this.route.snapshot.fragment;
    if (fragment && FRAGMENT_TAB_MAP[fragment]) {
      this.activeTab.set(FRAGMENT_TAB_MAP[fragment]);
    }
  }

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const name = `${this.user()?.firstName || ''} ${this.user()?.lastName || ''}`.trim();
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  }
}