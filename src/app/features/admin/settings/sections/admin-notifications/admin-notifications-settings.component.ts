import { Component, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';
import { AdminNotificationsService } from '@core/services/admin-notifications.service';
import { PushPermissionToggleComponent } from '@shared/components/push-permission-toggle/push-permission-toggle.component';

type AdminNotificationField = 'newOrder' | 'paymentNote' | 'mechanicRejection' | 'customerCancellation' | 'serviceProgress';

/**
 * "Notificaciones" section: browser push permission plus the per-event
 * preferences, each saved as soon as it is toggled.
 */
@Component({
  selector: 'app-admin-notifications-settings',
  standalone: true,
  imports: [ReactiveFormsModule, PushPermissionToggleComponent],
  templateUrl: './admin-notifications-settings.component.html',
  styleUrl: './admin-notifications-settings.component.scss',
})
export class AdminNotificationsSettingsComponent {
  private readonly settingsService = inject(SettingsService);
  protected readonly adminNotifications = inject(AdminNotificationsService);

  readonly adminNotificationsForm = input.required<FormGroup>();

  // Current site location — used in inline help text so prod admins see
  // their real domain instead of "localhost:4200".
  protected readonly currentHost = window.location.host;
  protected readonly currentOrigin = window.location.origin;

  protected readonly saveSuccess = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * Persists a single event-preference toggle. The push transport itself
   * lives on the `<app-push-permission-toggle>` (browser permission + FCM
   * token); this method only writes the per-event flags in settings.
   */
  protected saveAdminNotificationToggle(field: AdminNotificationField): void {
    const value = this.adminNotificationsForm().get(field)?.value;

    this.settingsService.updateAdminNotifications({ [field]: value }).subscribe({
      next: () => {
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 2000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar');
      },
    });
  }

  /**
   * Bound to the `<app-push-permission-toggle>` activate event. Runs
   * inside the toggle's click handler so the browser sees a real user
   * gesture and shows the native prompt.
   */
  protected async activateBrowserPermission(): Promise<void> {
    await this.adminNotifications.requestNotificationPermission();
  }

  /** Mirror for the deactivate event: drops the FCM token on the backend. */
  protected async deactivateBrowserPermission(): Promise<void> {
    await this.adminNotifications.unregisterToken();
  }

  /** Estado actual del permiso de notificaciones */
  protected getBrowserPushStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }
}
