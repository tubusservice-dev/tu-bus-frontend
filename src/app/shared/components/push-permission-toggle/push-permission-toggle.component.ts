import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { NotificationPermissionState } from '@core/services/user-notification.service';

/**
 * Reusable toggle that drives the browser push-notification permission
 * for the current user. Presentational only — the parent component owns
 * the lifecycle by emitting `activate` and `deactivate` callbacks.
 *
 * Two layouts:
 *   - default (full): toggle on the left, label/desc in the middle,
 *     status badge on the right. Suited for settings pages with room.
 *   - `compact` (no badge): toggle + text only, fits inside narrow
 *     dropdowns (e.g. the user menu) without wrapping text awkwardly.
 *
 * The native browser prompt only fires when the user clicks the toggle
 * (a real user gesture). That's why this component exists — automatic
 * flows are silently dropped by Safari / Brave / Firefox.
 */
@Component({
  selector: 'app-push-permission-toggle',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ppt-wrap"
      [class.is-compact]="compact()"
      [class.is-denied]="permission() === 'denied'"
    >
      <button
        type="button"
        class="ppt-toggle"
        role="switch"
        [attr.aria-checked]="isOn()"
        [disabled]="permission() === 'unsupported'"
        [class.on]="isOn()"
        (click)="onToggleClick()"
      >
        <span class="ppt-thumb"></span>
      </button>

      <div class="ppt-text">
        <span class="ppt-label">{{ label() }}</span>
        @if (description(); as desc) {
          <span class="ppt-desc">{{ desc }}</span>
        }
        @if (compact() && permission() === 'denied') {
          <button type="button" class="ppt-help-btn ppt-help-btn-inline" (click)="toggleHelp($event)">
            ¿Bloqueado? Toca aquí para desbloquear
          </button>
        }
      </div>

      @if (!compact()) {
        <div class="ppt-status">
          @switch (permission()) {
            @case ('granted') {
              @if (enabled()) {
                <span class="ppt-badge ppt-badge-on">Permitido</span>
              } @else {
                <span class="ppt-badge ppt-badge-paused">Pausado</span>
              }
            }
            @case ('default') {
              <span class="ppt-badge ppt-badge-pending">Pendiente</span>
            }
            @case ('denied') {
              <span class="ppt-badge ppt-badge-blocked">Bloqueado</span>
              <button type="button" class="ppt-help-btn" (click)="toggleHelp($event)">
                ¿Bloqueado?
              </button>
            }
            @default {
              <span class="ppt-badge ppt-badge-unsupported">No soportado</span>
            }
          }
        </div>
      }

      @if (showHelp()) {
        <div class="ppt-help-panel" role="status">
          <p class="ppt-help-title">Cómo desbloquear las notificaciones</p>
          <ol class="ppt-help-steps">
            <li>Abre la configuración del navegador en este sitio (candado <strong>🔒</strong> a la izquierda de la URL).</li>
            <li>Busca <strong>Notificaciones</strong> y cambia a <strong>Permitir</strong>.</li>
            <li>Recarga esta página y vuelve a activar el toggle.</li>
          </ol>
        </div>
      }
    </div>
  `,
  styles: [`
    .ppt-wrap {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 0.875rem;
      padding: 0.75rem 0.875rem;
      border: 1px solid var(--border-color, #e5e7eb);
      border-radius: 0.625rem;
      background-color: var(--bg-secondary, #f9fafb);
    }
    .ppt-wrap.is-compact {
      grid-template-columns: auto 1fr;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
    }
    :host-context(.dark) .ppt-wrap {
      border-color: #374151;
      background-color: rgba(31, 41, 55, 0.6);
    }

    .ppt-toggle {
      position: relative;
      width: 40px;
      height: 22px;
      border-radius: 999px;
      background-color: #cbd5e1;
      border: none;
      padding: 0;
      cursor: pointer;
      transition: background-color 0.2s ease;
      flex-shrink: 0;
    }
    .ppt-toggle:disabled { opacity: 0.5; cursor: not-allowed; }
    .ppt-toggle.on { background-color: #001d56; }
    :host-context(.dark) .ppt-toggle { background-color: #4b5563; }
    :host-context(.dark) .ppt-toggle.on { background-color: #3b82f6; }

    .ppt-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background-color: #ffffff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease;
    }
    .ppt-toggle.on .ppt-thumb { transform: translateX(18px); }

    .ppt-text {
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      min-width: 0;
    }
    .ppt-label {
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.25;
      color: var(--text-primary, #111827);
    }
    .ppt-wrap.is-compact .ppt-label { font-size: 0.8125rem; }
    :host-context(.dark) .ppt-label { color: #f3f4f6; }
    .ppt-desc {
      font-size: 0.75rem;
      line-height: 1.35;
      color: var(--text-secondary, #6b7280);
    }
    .ppt-wrap.is-compact .ppt-desc { font-size: 0.6875rem; }
    :host-context(.dark) .ppt-desc { color: #9ca3af; }

    .ppt-status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.25rem;
      flex-shrink: 0;
    }
    .ppt-badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      white-space: nowrap;
    }
    .ppt-badge-on        { background-color: #dcfce7; color: #166534; }
    .ppt-badge-paused    { background-color: #fef3c7; color: #92400e; }
    .ppt-badge-pending   { background-color: #e0e7ff; color: #3730a3; }
    .ppt-badge-blocked   { background-color: #fee2e2; color: #991b1b; }
    .ppt-badge-unsupported { background-color: #f3f4f6; color: #6b7280; }

    :host-context(.dark) .ppt-badge-on        { background-color: rgba(34, 197, 94, 0.15); color: #4ade80; }
    :host-context(.dark) .ppt-badge-paused    { background-color: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    :host-context(.dark) .ppt-badge-pending   { background-color: rgba(99, 102, 241, 0.15); color: #a5b4fc; }
    :host-context(.dark) .ppt-badge-blocked   { background-color: rgba(239, 68, 68, 0.15); color: #fca5a5; }
    :host-context(.dark) .ppt-badge-unsupported { background-color: rgba(107, 114, 128, 0.2); color: #d1d5db; }

    .ppt-help-btn {
      font-size: 0.6875rem;
      font-weight: 500;
      color: #2563eb;
      background: none;
      border: none;
      padding: 0;
      text-decoration: underline;
      cursor: pointer;
      text-align: left;
    }
    .ppt-help-btn-inline { margin-top: 0.25rem; }
    :host-context(.dark) .ppt-help-btn { color: #60a5fa; }

    .ppt-help-panel {
      grid-column: 1 / -1;
      padding: 0.75rem;
      margin-top: 0.25rem;
      border-radius: 0.5rem;
      background-color: rgba(254, 242, 242, 0.6);
      border: 1px solid #fecaca;
      font-size: 0.75rem;
      color: #7f1d1d;
    }
    :host-context(.dark) .ppt-help-panel {
      background-color: rgba(127, 29, 29, 0.2);
      border-color: rgba(239, 68, 68, 0.3);
      color: #fecaca;
    }
    .ppt-help-title { margin: 0 0 0.375rem 0; font-weight: 600; }
    .ppt-help-steps { margin: 0; padding-left: 1.125rem; display: flex; flex-direction: column; gap: 0.25rem; line-height: 1.4; }
  `],
})
export class PushPermissionToggleComponent {
  /** True when the FCM token is registered (i.e. push is functionally on). */
  readonly enabled = input.required<boolean>();
  /** Current browser permission state. Drives badge, toggle position, help link. */
  readonly permission = input.required<NotificationPermissionState>();
  /** Main label rendered next to the toggle. */
  readonly label = input<string>('Notificaciones del navegador');
  /** Optional secondary description shown under the label. */
  readonly description = input<string | undefined>(undefined);
  /**
   * Compact two-column layout: drops the right-side status badge so the
   * text has room in narrow containers (e.g. the user-menu dropdown).
   * Denied state surfaces an inline help link under the description.
   */
  readonly compact = input<boolean>(false);

  /** Emitted when the user wants to enable push (click on OFF). */
  readonly activate = output<void>();
  /** Emitted when the user wants to disable push (click on ON). */
  readonly deactivate = output<void>();

  protected readonly showHelp = signal(false);

  /** Visual ON when both the browser allows AND there is a registered token. */
  protected readonly isOn = computed(
    () => this.permission() === 'granted' && this.enabled()
  );

  protected onToggleClick(): void {
    const p = this.permission();
    if (p === 'unsupported') return;
    if (this.isOn()) {
      this.deactivate.emit();
      return;
    }
    // OFF → ON path. If denied, surface the help panel; otherwise emit
    // `activate` so the parent fires the permission prompt within this
    // gesture.
    if (p === 'denied') {
      this.showHelp.set(true);
      return;
    }
    this.activate.emit();
  }

  protected toggleHelp(event: MouseEvent): void {
    event.stopPropagation();
    this.showHelp.update((v) => !v);
  }
}
