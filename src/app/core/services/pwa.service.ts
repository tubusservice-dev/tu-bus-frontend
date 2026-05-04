import { Injectable, signal, computed, inject, NgZone } from '@angular/core';

/**
 * Native browser event fired when the app meets the install criteria.
 * Type is not in the standard lib.dom — declared inline.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * PwaService
 *
 * Single source of truth for the PWA lifecycle:
 *   1. Capture the `beforeinstallprompt` event so the UI can offer an
 *      in-app install button (instead of relying on the browser's menu).
 *   2. Track whether the app is already running in standalone mode.
 *   3. Detect when a new Service Worker version takes control so the UI
 *      can prompt the user to refresh for the latest bundle.
 *
 * The actual SW registration lives in main.ts — this service only
 * observes the lifecycle. Keeping the two concerns separate means the
 * SW is registered as early as possible, and Angular DI is not needed
 * to bootstrap the PWA shell.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly zone = inject(NgZone);

  /** Captured prompt event — present only when the browser allows install. */
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  private readonly _canInstall = signal(false);
  private readonly _isInstalled = signal(false);
  private readonly _updateReady = signal(false);

  /** True when the browser exposes an install prompt (Chrome, Edge, Samsung). */
  readonly canInstall = this._canInstall.asReadonly();

  /** True when the app is already running as an installed PWA. */
  readonly isInstalled = this._isInstalled.asReadonly();

  /** True when a new SW version has activated and the page should reload. */
  readonly updateReady = this._updateReady.asReadonly();

  /** Convenience: show the install button only when actually installable. */
  readonly showInstallButton = computed(
    () => this._canInstall() && !this._isInstalled(),
  );

  /**
   * Wires up the browser-level PWA listeners. Safe to call multiple times —
   * idempotent thanks to the deferredPrompt guard. Should be called once
   * during app bootstrap (e.g. from APP_INITIALIZER or the root component).
   */
  init(): void {
    if (typeof window === 'undefined') return;

    this.detectStandaloneMode();
    this.listenForInstallPrompt();
    this.listenForAppInstalled();
    this.listenForServiceWorkerUpdates();
  }

  /**
   * Triggers the native install prompt. Must be called from a user gesture
   * (click handler) — calling outside one is silently rejected by Chrome.
   *
   * Returns the user's choice so the caller can react (e.g. log analytics).
   */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) return 'unavailable';

    try {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      // The prompt can only be used once — discard after first use.
      this.deferredPrompt = null;
      this._canInstall.set(false);
      return outcome;
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Reloads the page to pick up the latest assets controlled by the new
   * Service Worker. The SW already called skipWaiting + clients.claim,
   * so a simple reload is enough — no manual SW message required here.
   */
  applyUpdate(): void {
    window.location.reload();
  }

  // ─── Private ─────────────────────────────────────────────────────

  private detectStandaloneMode(): void {
    // iOS Safari uses navigator.standalone; everyone else uses the media
    // query. Either match means we're already inside the installed app.
    const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const matchStandalone = window.matchMedia('(display-mode: standalone)').matches;
    this._isInstalled.set(iosStandalone || matchStandalone);
  }

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Prevent the mini-infobar on mobile — we control the prompt UX.
      event.preventDefault();
      this.zone.run(() => {
        this.deferredPrompt = event as BeforeInstallPromptEvent;
        this._canInstall.set(true);
      });
    });
  }

  private listenForAppInstalled(): void {
    window.addEventListener('appinstalled', () => {
      this.zone.run(() => {
        this.deferredPrompt = null;
        this._canInstall.set(false);
        this._isInstalled.set(true);
      });
    });
  }

  private listenForServiceWorkerUpdates(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // A new SW just took control — assets in memory may differ from
      // what's on disk. Surface a flag so the UI can suggest a reload.
      this.zone.run(() => this._updateReady.set(true));
    });
  }
}
