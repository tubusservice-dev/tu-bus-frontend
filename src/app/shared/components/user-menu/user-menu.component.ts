import { Component, signal, inject, computed, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services';
import { ThemeService } from '@core/services/theme.service';
import { UserNotificationService } from '@core/services/user-notification.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';
import { PushUnblockModalComponent } from '@shared/components/push-unblock-modal/push-unblock-modal.component';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [RouterLink, ClickOutsideDirective, PushUnblockModalComponent],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss'
})
export class UserMenuComponent implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);
  private readonly scrollLock = inject(BodyScrollLockService);
  /** True while this component holds the body scroll lock for its logout modal. */
  private hasScrollLock = false;

  protected readonly user = this.authService.currentUser;
  protected readonly userName = this.authService.userFullName;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly userEmail = computed(() => this.user()?.email ?? '');

  protected readonly isMenuOpen = signal(false);
  protected readonly showLogoutModal = signal(false);
  protected readonly showUnblockModal = signal(false);

  protected readonly userNotifService = inject(UserNotificationService);

  /**
   * Handler for the "Permitir" CTA inside the push-alert banner.
   *
   * Branches on the current permission state:
   *   - `'default'` (user never decided): triggers the native browser
   *     prompt directly so the click counts as a user gesture.
   *   - `'denied'` (user already refused or blocked from site settings):
   *     the browser silently returns 'denied' without prompting, so
   *     calling requestPermission again is pointless. Instead, open the
   *     unblock-instructions modal that guides the user through the
   *     browser settings.
   *   - `'granted'` / `'unsupported'`: the banner is hidden by the
   *     template guard, so this method should not run in those states.
   */
  async activatePushNotifications(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'denied') {
      this.closeMenu();
      this.showUnblockModal.set(true);
      return;
    }

    try {
      await Notification.requestPermission();
    } catch {
      /* user cancelled the prompt — nothing to do */
    }
    this.userNotifService.syncPermissionState();
  }

  protected closeUnblockModal(): void {
    this.showUnblockModal.set(false);
  }

  ngOnDestroy(): void {
    // Defensive — release the lock if the host header is torn down while
    // the logout confirmation modal is still on screen.
    this.releaseScrollLock();
  }

  toggleMenu(): void {
    this.isMenuOpen.update(value => !value);
    if (this.isMenuOpen()) this.userNotifService.closePopover();
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  requestLogout(): void {
    this.closeMenu();
    this.showLogoutModal.set(true);
    this.acquireScrollLock();
  }

  cancelLogout(): void {
    this.showLogoutModal.set(false);
    this.releaseScrollLock();
  }

  confirmLogout(): void {
    this.showLogoutModal.set(false);
    this.releaseScrollLock();
    this.authService.logout();
  }

  private acquireScrollLock(): void {
    if (this.hasScrollLock) return;
    this.scrollLock.lock();
    this.hasScrollLock = true;
  }

  private releaseScrollLock(): void {
    if (!this.hasScrollLock) return;
    this.scrollLock.unlock();
    this.hasScrollLock = false;
  }

  isActive(path: string, fragment?: string): boolean {
    const url = this.router.url.split('?')[0];
    const hashIdx = url.indexOf('#');
    const urlPath = hashIdx === -1 ? url : url.slice(0, hashIdx);
    const urlFragment = hashIdx === -1 ? null : url.slice(hashIdx + 1);

    if (urlPath !== path) return false;
    return fragment ? urlFragment === fragment : urlFragment === null;
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const name = this.userName();
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  }
}
