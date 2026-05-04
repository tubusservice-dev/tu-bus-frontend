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

/** localStorage key for persisting the "dismiss for 7 days" choice. */
const INSTALL_DISMISSED_KEY = 'pwa_install_dismissed_at';

/** How long the persistent dismissal lasts before the modal returns. */
const INSTALL_DISMISSED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * PwaService
 *
 * Single source of truth for the PWA lifecycle:
 *   1. Capture `beforeinstallprompt` so we can drive an in-app modal
 *      and a header fallback button (Chrome no longer auto-prompts).
 *   2. Track whether the app is already running in standalone mode.
 *   3. Detect REAL Service Worker updates (not first-installs) so the
 *      update banner only appears when there's actually a new version.
 *
 * Modal vs Button visibility (mutually exclusive):
 *   - Modal:  shown on first eligible visit (installable, not installed,
 *             not dismissed). Proactive UX.
 *   - Button: shown only after the modal has been dismissed (this
 *             session or persistently). Acts as a recovery affordance.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly zone = inject(NgZone);

  /** Captured prompt event — present only when the browser allows install. */
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  /**
   * True when the page already had a SW controller at load time.
   * Used to distinguish first-install (no previous controller → not an
   * update) from a true update (existing SW replaced by a new one).
   */
  private wasControlledOnLoad = false;

  private readonly _canInstall = signal(false);
  private readonly _isInstalled = signal(false);
  private readonly _updateReady = signal(false);
  private readonly _installModalSessionDismissed = signal(false);

  /** True when the browser exposes an install prompt (Chrome, Edge, Samsung). */
  readonly canInstall = this._canInstall.asReadonly();

  /** True when the app is already running as an installed PWA. */
  readonly isInstalled = this._isInstalled.asReadonly();

  /** True when a NEW SW version has activated (never on first-install). */
  readonly updateReady = this._updateReady.asReadonly();

  /**
   * Modal visibility. True when:
   *   - The browser fired beforeinstallprompt (installable)
   *   - The app is not already installed
   *   - The user did not dismiss this session
   *   - The user did not dismiss within the last 7 days
   */
  readonly showInstallModal = computed(
    () =>
      this._canInstall() &&
      !this._isInstalled() &&
      !this._installModalSessionDismissed() &&
      !this.isPersistentlyDismissed(),
  );

  /**
   * Header button visibility. Mutually exclusive with the modal — only
   * appears once the modal has been dismissed, so installable users
   * always have a way to install.
   */
  readonly showInstallButton = computed(
    () =>
      this._canInstall() &&
      !this._isInstalled() &&
      (this._installModalSessionDismissed() || this.isPersistentlyDismissed()),
  );

  /**
   * Wires up browser-level PWA listeners. Idempotent — safe to call
   * multiple times. Should run once during app bootstrap.
   */
  init(): void {
    if (typeof window === 'undefined') return;

    // Snapshot the controller state BEFORE attaching update listeners so
    // we can tell first-install (null → SW) from real updates (SW → SW).
    this.wasControlledOnLoad =
      'serviceWorker' in navigator && !!navigator.serviceWorker.controller;

    this.detectStandaloneMode();
    this.listenForInstallPrompt();
    this.listenForAppInstalled();
    this.listenForServiceWorkerUpdates();
  }

  /**
   * Triggers the native install prompt. Must be called from a user
   * gesture (click handler) — Chrome silently rejects calls outside one.
   */
  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) return 'unavailable';

    try {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      // The prompt object is single-use — discard after first call.
      this.deferredPrompt = null;
      this._canInstall.set(false);
      return outcome;
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Hides the install modal until the next page load. Used by the
   * X (close) button. The header fallback button takes over.
   */
  dismissInstallModalSession(): void {
    this._installModalSessionDismissed.set(true);
  }

  /**
   * Hides the install modal for 7 days. Used by the "Más tarde" button.
   * Falls back to session dismissal if localStorage is unavailable.
   */
  dismissInstallModalPersistent(): void {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // Private browsing or quota — at least keep the session flag
      // so the modal doesn't reappear right away.
    }
    this._installModalSessionDismissed.set(true);
  }

  /**
   * Reloads the page to pick up the latest assets controlled by the new
   * Service Worker. The SW already used skipWaiting + clients.claim,
   * so a simple reload is enough.
   */
  applyUpdate(): void {
    window.location.reload();
  }

  // ─── Private ─────────────────────────────────────────────────────

  /** Reads the persistent dismissal timestamp and checks if it's still active. */
  private isPersistentlyDismissed(): boolean {
    try {
      const raw = localStorage.getItem(INSTALL_DISMISSED_KEY);
      if (!raw) return false;
      const dismissedAt = Number(raw);
      if (!Number.isFinite(dismissedAt)) return false;
      return Date.now() - dismissedAt < INSTALL_DISMISSED_TTL_MS;
    } catch {
      return false;
    }
  }

  private detectStandaloneMode(): void {
    // iOS Safari uses navigator.standalone; everyone else uses the media
    // query. Either match means we're already inside the installed app.
    const iosStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const matchStandalone = window.matchMedia('(display-mode: standalone)').matches;
    this._isInstalled.set(iosStandalone || matchStandalone);
  }

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      // Suppress the legacy mini-infobar; we own the prompt UX.
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
      // Skip first-install: page transitioned from "no controller" to
      // "this SW controls". That's expected on initial load and is NOT
      // an update — only fire for real version replacements.
      if (!this.wasControlledOnLoad) return;
      this.zone.run(() => this._updateReady.set(true));
    });
  }
}
