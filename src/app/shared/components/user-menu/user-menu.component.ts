import { Component, signal, inject, computed, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services';
import { ThemeService } from '@core/services/theme.service';
import { UserNotificationService } from '@core/services/user-notification.service';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';
import { PushUnblockModalComponent } from '@shared/components/push-unblock-modal/push-unblock-modal.component';
import { PlatformService } from '@platform';

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
  private readonly platform = inject(PlatformService);
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
   * Branches first on platform, then on permission state:
   *
   *   Native (Android app):
   *     The Capacitor Firebase Messaging plugin owns the OS-level prompt
   *     for POST_NOTIFICATIONS. We delegate fully to
   *     `userNotifService.requestNotificationPermission()` which already
   *     contains the gated native flow (request → token → register).
   *     The `Notification` global does NOT exist inside the Capacitor
   *     WebView, so the legacy web check below would short-circuit and
   *     leave the button doing nothing — that was the original bug.
   *
   *   Web (browser):
   *     - `'default'`: trigger Notification.requestPermission directly so
   *       the click counts as a user gesture (browsers ignore prompts
   *       outside one).
   *     - `'denied'`: the browser silently returns 'denied' without
   *       prompting, so calling requestPermission again is pointless.
   *       Open the unblock-instructions modal instead.
   *     - `'granted'` / `'unsupported'`: the banner is hidden by the
   *       template guard, so this method should not run in those states.
   */
  async activatePushNotifications(): Promise<void> {
    if (this.platform.isNative()) {
      // Re-sync first so the branch below uses the *real* OS state, not
      // whatever stale value the signal had from a previous render.
      // Android 13+ silently rejects re-prompts when the user already
      // tapped "Don't allow" — calling requestPermissions() in that case
      // would make the button feel broken.
      const state = await this.userNotifService.syncPermissionState();
      if (state === 'denied') {
        this.closeMenu();
        this.showUnblockModal.set(true);
        return;
      }
      if (state === 'granted') {
        // Already granted at OS level but the in-memory token may be
        // missing — request triggers the rehydration path inside the
        // service. Safe to call: idempotent on the plugin side.
        await this.userNotifService.requestNotificationPermission();
        return;
      }
      // 'default' → first-time prompt path.
      await this.userNotifService.requestNotificationPermission();
      return;
    }

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
    void this.userNotifService.syncPermissionState();
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
