import { Component, signal, inject, computed, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services';
import { ThemeService } from '@core/services/theme.service';
import { UserNotificationService } from '@core/services/user-notification.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [RouterLink, ClickOutsideDirective],
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

  protected readonly userNotifService = inject(UserNotificationService);

  /**
   * Standalone handler for the "Activar notificaciones" menu button.
   * Triggers the browser's native permission prompt directly — does NOT
   * go through the push toggle flow on purpose, so the button keeps
   * working when the toggle is moved elsewhere.
   *
   * Browser semantics:
   *   - `'default'`: shows the prompt.
   *   - `'denied'`: the browser silently returns 'denied' without prompting.
   *     The button still fires the call (per product spec) — the user must
   *     unblock from the site settings if they want to revert it.
   *   - `'granted'`: the button is hidden by the template guard.
   */
  async activatePushNotifications(): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      await Notification.requestPermission();
    } catch {
      /* user cancelled the prompt — nothing to do */
    }
    this.userNotifService.syncPermissionState();
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
