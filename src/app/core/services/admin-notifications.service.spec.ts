import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { AdminNotificationsService } from './admin-notifications.service';
import { AuthService } from './auth.service';
import { SettingsService } from './settings.service';
import { DeviceTokenService } from './device-token.service';
import { FirebaseMessagingService } from '@core/firebase';

/**
 * Covers the admin notifications regressions:
 *  - the session check read `localStorage`, which is empty on the native app
 *    (token lives in Capacitor Preferences), so admins never got counts;
 *  - counters and polling survived logout.
 */
describe('AdminNotificationsService', () => {
  const currentUser = signal<Record<string, unknown> | null>(null);
  let service: AdminNotificationsService;
  let http: HttpTestingController;

  const unreadCountCalls = () =>
    http.match((req) => req.url.endsWith('/admin/notifications/unread-count'));

  beforeEach(() => {
    currentUser.set(null);
    localStorage.removeItem('admin_auth_token'); // simulate the native app

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { currentUser } },
        { provide: SettingsService, useValue: { adminNotificationsConfig: () => null } },
        { provide: DeviceTokenService, useValue: {} },
        {
          provide: FirebaseMessagingService,
          useValue: {
            onPushReceived$: new Subject(),
            onForegroundMessage$: new Subject(),
            requestToken: () => Promise.resolve(null),
            isMessagingSupportedSync: () => false,
          },
        },
      ],
    });
    service = TestBed.inject(AdminNotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopPolling();
    http.verify();
  });

  it('fetches the unread count for a signed-in admin even with no token in localStorage', () => {
    currentUser.set({ role: 'admin' });

    service.fetchUnreadCount();

    const calls = unreadCountCalls();
    expect(calls.length).toBe(1);
    calls[0].flush({ success: true, data: { count: 4 } });
    expect(service.unreadCount()).toBe(4);
  });

  it('does not call the admin API for a customer session', () => {
    currentUser.set({ role: 'customer' });

    service.fetchUnreadCount();
    service.fetchRecent();

    expect(unreadCountCalls().length).toBe(0);
    http.expectNone((req) => req.url.includes('/admin/notifications'));
  });

  it('clears counters when the admin session ends', () => {
    currentUser.set({ role: 'admin' });
    TestBed.tick();
    service.fetchUnreadCount();
    unreadCountCalls()[0].flush({ success: true, data: { count: 7 } });
    expect(service.unreadCount()).toBe(7);

    currentUser.set(null); // logout
    TestBed.tick();

    expect(service.unreadCount()).toBe(0);
    expect(service.notifications()).toEqual([]);
    expect(service.showPopover()).toBeFalse();
  });

  it('keeps polling started by the layout while the admin profile is still loading', () => {
    // App start: user not hydrated yet, layout already started polling.
    service.startPolling();
    TestBed.tick();

    // No reset happened, so once the admin is known the next tick fetches.
    currentUser.set({ role: 'admin' });
    TestBed.tick();
    service.fetchUnreadCount();
    expect(unreadCountCalls().length).toBe(1);
  });
});
