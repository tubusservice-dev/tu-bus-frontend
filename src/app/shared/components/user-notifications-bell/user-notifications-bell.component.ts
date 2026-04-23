import { Component, inject, signal, OnInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserNotificationService } from '../../../core/services/user-notification.service';
import { UserNotification } from '../../../models/user-notification.model';

@Component({
  selector: 'app-user-notifications-bell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notif-wrap">
      <button type="button" class="notif-btn" (click)="toggle()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        @if (notifService.unreadCount() > 0) {
          <span class="notif-badge">{{ notifService.unreadCount() > 9 ? '9+' : notifService.unreadCount() }}</span>
        }
      </button>

      @if (notifService.showPopover()) {
        <!-- Backdrop -->
        <div class="notif-backdrop" (click)="close()"></div>

        <div class="notif-panel">
          <!-- Header -->
          <div class="panel-header">
            @if (selectedNotification()) {
              <button type="button" class="panel-back" (click)="selectedNotification.set(null)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
              </button>
              <span class="panel-title">Detalle</span>
            } @else {
              <span class="panel-title">Notificaciones</span>
              @if (notifService.unreadCount() > 0) {
                <button type="button" class="mark-all-btn" (click)="markAllRead()">Marcar todas</button>
              }
            }
          </div>

          <!-- List View -->
          @if (!selectedNotification()) {
            <div class="panel-list">
              @if (notifService.notifications().length === 0) {
                <div class="panel-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                  <span>No tienes notificaciones</span>
                </div>
              } @else {
                @for (n of notifService.notifications(); track n.id) {
                  <button type="button" class="notif-item" [class.unread]="!n.isRead" (click)="openDetail(n)">
                    <div class="notif-icon" [ngClass]="'icon-' + n.icon">
                      @switch (n.icon) {
                        @case ('success') {
                          <!-- Check circle -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        }
                        @case ('mechanic') {
                          <!-- Wrench complete -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75" /></svg>
                        }
                        @case ('truck') {
                          <!-- Truck / vehicle moving -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                        }
                        @case ('user-plus') {
                          <!-- User plus (assigned) -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>
                        }
                        @case ('box') {
                          <!-- Package / box -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
                        }
                        @case ('cancel') {
                          <!-- No symbol -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        }
                        @case ('warning') {
                          <!-- Exclamation triangle -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                        }
                        @case ('payment') {
                          <!-- Credit card / banknotes -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
                        }
                        @case ('order') {
                          <!-- Shopping bag -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                        }
                        @default {
                          <!-- Bell -->
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                        }
                      }
                    </div>
                    <div class="notif-content">
                      <span class="notif-title">{{ n.title }}</span>
                      <span class="notif-msg">{{ n.message | slice:0:60 }}{{ n.message.length > 60 ? '...' : '' }}</span>
                      <span class="notif-time">{{ n.createdAt | date:'dd/MM HH:mm' }}</span>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="notif-chevron"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  </button>
                }
              }
            </div>
          }

          <!-- Footer with "Ver todas" -->
          @if (!selectedNotification()) {
            <div class="panel-footer">
              <button type="button" class="view-all-btn" (click)="goToAllNotifications()">Ver todas las notificaciones</button>
            </div>
          }

          <!-- Detail View -->
          @if (selectedNotification()) {
            <div class="panel-detail">
              <div class="detail-icon-wrap" [ngClass]="'icon-' + selectedNotification()!.icon">
                @switch (selectedNotification()!.icon) {
                  @case ('success') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  }
                  @case ('mechanic') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75" /></svg>
                  }
                  @case ('truck') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                  }
                  @case ('user-plus') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" /></svg>
                  }
                  @case ('box') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
                  }
                  @case ('cancel') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  }
                  @case ('warning') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                  }
                  @case ('payment') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
                  }
                  @case ('order') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                  }
                  @default {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
                  }
                }
              </div>
              <h3 class="detail-title">{{ selectedNotification()!.title }}</h3>
              <p class="detail-message">{{ selectedNotification()!.message }}</p>
              <span class="detail-time">{{ selectedNotification()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>

              @if (getOrderId(selectedNotification()!)) {
                <button type="button" class="detail-btn" (click)="goToOrder(selectedNotification()!)">
                  Ver pedido
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .notif-wrap { @apply relative; }
    .notif-btn {
      @apply relative p-2 rounded-lg transition-all duration-200;
      background-color: var(--bg-tertiary);
      color: var(--text-primary);
      &:hover { background-color: var(--border-color-hover); color: var(--accent-primary); }
      svg { @apply w-5 h-5; }
    }
    :host-context(.dark) .notif-btn {
      background-color: #374151;
      color: #f3f4f6;
      &:hover { background-color: #4b5563; }
    }
    .notif-badge {
      @apply absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center;
      min-width: 16px; height: 16px; padding: 0 3px;
    }

    // Backdrop
    .notif-backdrop {
      @apply fixed inset-0 z-40;
      @apply bg-black/50 sm:bg-transparent;
    }

    // Panel — full screen mobile, popover desktop
    .notif-panel {
      @apply fixed inset-0 z-50 bg-white dark:bg-gray-800 flex flex-col;
      @apply sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:rounded-xl sm:shadow-xl sm:border sm:border-gray-200 dark:sm:border-gray-700;
      @apply sm:w-80 sm:max-h-[70vh];
      animation: slideUp 0.2s ease;
    }
    @media (min-width: 640px) {
      .notif-panel { animation: fadeIn 0.15s ease; }
    }

    // Header
    .panel-header {
      @apply flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0;
      padding-top: max(0.75rem, env(safe-area-inset-top));
    }
    .panel-title { @apply text-sm font-semibold text-gray-900 dark:text-white; }
    .panel-back {
      @apply p-1 mr-2 text-gray-500 dark:text-gray-400 hover:text-gray-700;
      svg { @apply w-5 h-5; }
    }
    .panel-close {
      @apply p-1 ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300;
      svg { @apply w-5 h-5; }
    }
    .mark-all-btn { @apply ml-auto text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline; }

    // List
    .panel-list { @apply flex-1 overflow-y-auto; }
    .panel-empty {
      @apply flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500 gap-3;
      .empty-icon { @apply w-10 h-10; }
      span { @apply text-sm; }
    }

    .notif-item {
      @apply w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700/50;
      @apply hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors;
      &.unread { @apply bg-blue-50/50 dark:bg-blue-900/10; }
    }
    .notif-icon {
      @apply w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0;
      svg { @apply w-4 h-4; }
      &.icon-success { @apply bg-green-100 dark:bg-green-900/30; svg { @apply text-green-600; } }
      &.icon-mechanic { @apply bg-purple-100 dark:bg-purple-900/30; svg { @apply text-purple-600; } }
      &.icon-order { @apply bg-indigo-100 dark:bg-indigo-900/30; svg { @apply text-indigo-600; } }
      &.icon-cancel { @apply bg-red-100 dark:bg-red-900/30; svg { @apply text-red-600; } }
      &.icon-warning { @apply bg-amber-100 dark:bg-amber-900/30; svg { @apply text-amber-600; } }
      &.icon-payment { @apply bg-emerald-100 dark:bg-emerald-900/30; svg { @apply text-emerald-600; } }
      &.icon-truck { @apply bg-cyan-100 dark:bg-cyan-900/30; svg { @apply text-cyan-600; } }
      &.icon-user-plus { @apply bg-blue-100 dark:bg-blue-900/30; svg { @apply text-blue-600; } }
      &.icon-box { @apply bg-indigo-100 dark:bg-indigo-900/30; svg { @apply text-indigo-600; } }
    }
    .notif-content { @apply flex flex-col min-w-0 flex-1; }
    .notif-title { @apply text-xs font-semibold text-gray-900 dark:text-white truncate; }
    .notif-msg { @apply text-[11px] text-gray-500 dark:text-gray-400 leading-tight; }
    .notif-time { @apply text-[10px] text-gray-400 dark:text-gray-500 mt-0.5; }
    .notif-chevron { @apply w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0; }

    // Footer
    .panel-footer {
      @apply px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0;
    }
    .view-all-btn {
      @apply w-full py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-center transition-colors;
    }

    // Detail
    .panel-detail { @apply flex-1 overflow-y-auto px-5 py-6 flex flex-col; }
    .detail-icon-wrap {
      @apply w-14 h-14 rounded-full flex items-center justify-center mb-4;
      svg { @apply w-7 h-7; }
      &.icon-success { @apply bg-green-100 dark:bg-green-900/30; svg { @apply text-green-600; } }
      &.icon-mechanic { @apply bg-purple-100 dark:bg-purple-900/30; svg { @apply text-purple-600; } }
      &.icon-order { @apply bg-indigo-100 dark:bg-indigo-900/30; svg { @apply text-indigo-600; } }
      &.icon-cancel { @apply bg-red-100 dark:bg-red-900/30; svg { @apply text-red-600; } }
      &.icon-warning { @apply bg-amber-100 dark:bg-amber-900/30; svg { @apply text-amber-600; } }
      &.icon-payment { @apply bg-emerald-100 dark:bg-emerald-900/30; svg { @apply text-emerald-600; } }
      &.icon-truck { @apply bg-cyan-100 dark:bg-cyan-900/30; svg { @apply text-cyan-600; } }
      &.icon-user-plus { @apply bg-blue-100 dark:bg-blue-900/30; svg { @apply text-blue-600; } }
      &.icon-box { @apply bg-indigo-100 dark:bg-indigo-900/30; svg { @apply text-indigo-600; } }
    }
    .detail-title { @apply text-base font-semibold text-gray-900 dark:text-white mb-2; }
    .detail-message {
      @apply text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .detail-time { @apply text-xs text-gray-400 dark:text-gray-500 mb-6; }
    .detail-btn {
      @apply px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors;
    }

    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  `],
})
export class UserNotificationsBellComponent implements OnInit, OnDestroy {
  protected readonly notifService = inject(UserNotificationService);
  private readonly router = inject(Router);
  private readonly elRef = inject(ElementRef);

  protected readonly selectedNotification = signal<UserNotification | null>(null);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.notifService.showPopover() && !this.elRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  ngOnInit(): void {
    this.notifService.requestNotificationPermission();
    this.notifService.startPolling();
  }

  ngOnDestroy(): void {
    this.notifService.stopPolling();
  }

  toggle(): void {
    this.selectedNotification.set(null);
    this.notifService.togglePopover();
  }

  close(): void {
    this.selectedNotification.set(null);
    this.notifService.closePopover();
  }

  openDetail(n: UserNotification): void {
    if (!n.isRead) {
      this.notifService.markAsRead(n.id).subscribe();
    }
    this.selectedNotification.set(n);
  }

  goToOrder(n: UserNotification): void {
    const orderId = this.getOrderId(n);
    if (orderId) {
      this.close();
      this.router.navigate(['/perfil/pedidos', orderId]);
    }
  }

  getOrderId(n: UserNotification): string {
    if (!n.relatedOrder) return '';
    return typeof n.relatedOrder === 'object' ? (n.relatedOrder.id || n.relatedOrder._id || '') : String(n.relatedOrder);
  }

  goToAllNotifications(): void {
    this.close();
    this.router.navigate(['/perfil'], { fragment: 'notificaciones' });
  }

  markAllRead(): void {
    this.notifService.markAllAsRead().subscribe();
  }

}
