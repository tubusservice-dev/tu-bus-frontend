import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core';
import { ProfileInfoComponent } from './profile-info/profile-info.component';
import { GarageComponent } from '../garage/garage.component';
import { OrderListComponent } from '../orders/order-list/order-list.component';
import { PaymentHistoryComponent } from './components/payment-history/payment-history.component';

type ProfileTab = 'profile' | 'garage' | 'orders' | 'payments';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ProfileInfoComponent, GarageComponent, OrderListComponent, PaymentHistoryComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);

  protected readonly user = this.authService.currentUser;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly activeTab = signal<ProfileTab>('profile');

  setTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }
}