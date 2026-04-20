import { Component, inject, signal, computed, input, output, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MechanicAssignmentService } from '../../../../core/services/mechanic-assignment.service';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { AvailableMechanic, MechanicAssignment } from '../../../../models/mechanic-assignment.model';
import { Mechanic } from '../../../../models/mechanic.model';
import {
  Order,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  OrderStatus,
} from '../../../../models/order.model';
import { environment } from '../../../../../environments/environment';
import { MechanicAvatarComponent } from '../../../../shared/components/mechanic-avatar/mechanic-avatar.component';

@Component({
  selector: 'app-order-dispatch-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MechanicAvatarComponent],
  template: `
    @if (isOpen()) {
      <div class="modal-overlay" (click)="onClose()">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title">Asignar Mecanico</h3>
            <button type="button" class="btn-close" (click)="onClose()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Order Info -->
          <div class="order-info">
            <span class="order-number">Orden #{{ order()?.orderNumber }}</span>
            @if (order()?.status) {
              <span class="dispatch-badge" [ngClass]="getStatusColor(order()!.status)">
                {{ getStatusLabel(order()!.status) }}
              </span>
            }
          </div>

          <!-- Loading assignment -->
          @if (isLoadingAssignment()) {
            <div class="loading-assignment">
              <span class="spinner-sm"></span>
              <span>Cargando asignación...</span>
            </div>
          }

          <!-- Already assigned -->
          @else if (currentAssignment()) {
            <div class="assigned-section">
              <div class="assigned-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-check">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>Mecanico asignado</span>
              </div>
              <div class="mechanic-info">
                @if (getAssignedMechanicName()) {
                  <div class="mechanic-info-row">
                    <app-mechanic-avatar
                      [avatar]="getAssignedMechanicAvatar()"
                      [name]="getAssignedMechanicName()"
                      size="md"
                    />
                    <div class="mechanic-info-text">
                      <p class="mechanic-name">{{ getAssignedMechanicName() }}</p>
                      <p class="mechanic-phone">{{ getAssignedMechanicWhatsapp() }}</p>
                    </div>
                  </div>
                }

                <!-- Fecha y hora del servicio — bloque destacado -->
                <div class="schedule-block" role="group" aria-label="Fecha y hora del servicio">
                  <div class="schedule-header">Fecha y hora del servicio</div>
                  <div class="schedule-chips">
                    <div class="schedule-chip schedule-chip-date">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                      </svg>
                      <div class="schedule-chip-text">
                        <span class="schedule-chip-label">Fecha</span>
                        <span class="schedule-chip-value">
                          {{ getFormattedScheduledDate() }}
                        </span>
                      </div>
                    </div>
                    <div class="schedule-chip schedule-chip-time">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <div class="schedule-chip-text">
                        <span class="schedule-chip-label">Horario</span>
                        <span class="schedule-chip-value">
                          {{ currentAssignment()!.startTime }} <span class="schedule-chip-sep">→</span> {{ currentAssignment()!.endTime }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Progress Link -->
              <div class="magic-link-section">
                <label class="link-label">Enlace de progreso:</label>
                <div class="link-box">
                  <input type="text" [value]="progressLink()" readonly class="link-input" />
                  <button type="button" class="btn-copy" (click)="copyLink()">
                    @if (linkCopied()) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    } @else {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" /></svg>
                    }
                  </button>
                </div>
                @if (getAssignedMechanicWhatsapp()) {
                  <a [href]="getWhatsAppUrl()" target="_blank" rel="noopener noreferrer" class="btn-whatsapp">
                    <svg viewBox="0 0 24 24" fill="currentColor" class="whatsapp-icon"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    Enviar por WhatsApp
                  </a>
                }
              </div>

              <!-- Cancel current assignment -->
              <button type="button" class="btn-cancel-current" [disabled]="isCancellingAssignment()" (click)="cancelCurrentAssignment()">
                @if (isCancellingAssignment()) { Cancelando... } @else { Cancelar asignacion y reasignar }
              </button>
            </div>
          } @else {
            <!-- NEW FLOW: Mechanic first → Date → Available slots -->
            <div class="select-section">
              <!-- Step indicators -->
              <div class="steps-indicator">
                <div class="step-ind" [class.active]="!selectedMechanicId" [class.done]="selectedMechanicId">
                  <span class="step-num">@if (selectedMechanicId) { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> } @else { 1 }</span>
                  <span class="step-text">Mecanico</span>
                </div>
                <div class="step-line-h" [class.done]="selectedMechanicId"></div>
                <div class="step-ind" [class.active]="selectedMechanicId && !selectedDate" [class.done]="selectedDate">
                  <span class="step-num">@if (selectedDate) { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> } @else { 2 }</span>
                  <span class="step-text">Fecha</span>
                </div>
                <div class="step-line-h" [class.done]="selectedDate"></div>
                <div class="step-ind" [class.active]="selectedDate && !selectedStartTime" [class.done]="selectedStartTime">
                  <span class="step-num">@if (selectedStartTime) { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> } @else { 3 }</span>
                  <span class="step-text">Horario</span>
                </div>
              </div>

              <!-- Step 1: Select Mechanic -->
              <div class="step-section">
                <h4 class="step-title">
                  Seleccionar Mecanico
                </h4>
                @if (isLoadingMechanics()) {
                  <div class="loading-inline"><span class="spinner-sm"></span> Cargando mecanicos...</div>
                } @else if (branchMechanics().length === 0) {
                  <div class="empty-msg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                    No hay mecanicos asignados a la sucursal de esta orden
                  </div>
                } @else {
                  <div class="mechanics-list">
                    @for (mech of branchMechanics(); track mech.id) {
                      <div class="mechanic-card-opt" [class.selected]="selectedMechanicId === mech.id" (click)="selectMechanic(mech)">
                        <app-mechanic-avatar
                          [avatar]="getMechanicAvatar(mech)"
                          [name]="mech.name"
                          size="sm"
                        />
                        <div class="mech-card-info">
                          <span class="mech-card-name">{{ mech.name }}</span>
                          <span class="mech-card-meta">{{ mech.whatsapp }} &bull; {{ mech.serviceDurationMinutes }}min</span>
                        </div>
                        @if (selectedMechanicId === mech.id) {
                          <div class="mech-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg></div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Step 2: Select Date -->
              @if (selectedMechanicId) {
                <div class="step-section">
                  <h4 class="step-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="step-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                    Fecha del servicio
                  </h4>
                  <input type="date" id="schedule-date" [(ngModel)]="selectedDate" (ngModelChange)="onDateChange()" [min]="todayStr" class="form-input" [class.input-error]="isDatePast()" />
                  @if (isDatePast()) {
                    <div class="date-error">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
                      Fecha no valida — seleccione una fecha a partir de hoy
                    </div>
                  }
                </div>
              }

              <!-- Step 3: Free time selection -->
              @if (selectedMechanicId && selectedDate && !isDatePast()) {
                <div class="step-section">
                  <h4 class="step-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="step-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    Hora de inicio
                  </h4>
                  <input type="time" [(ngModel)]="selectedStartTime" (ngModelChange)="onTimeChange()" class="form-input" [class.input-error]="isTimeInPast()" />

                  @if (isTimeInPast()) {
                    <div class="date-error">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
                      No se puede asignar una hora que ya paso
                    </div>
                  } @else if (selectedStartTime && calculatedEndTime()) {
                    <div class="time-preview" [class.conflict]="availabilityStatus() === 'conflict'">
                      <div class="time-range">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        {{ selectedStartTime }} - {{ calculatedEndTime() }}
                        <span class="duration-tag">{{ selectedMechanic()?.serviceDurationMinutes }}min</span>
                      </div>
                      @if (availabilityStatus() === 'checking') {
                        <span class="avail-checking"><span class="spinner-sm"></span> Verificando...</span>
                      } @else if (availabilityStatus() === 'available') {
                        <span class="avail-ok">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                          Disponible
                        </span>
                      } @else if (availabilityStatus() === 'conflict') {
                        <span class="avail-conflict">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                          Horario no disponible
                        </span>
                      } @else if (availabilityStatus() === 'outside') {
                        <span class="avail-conflict">Fuera del horario laboral</span>
                      }
                    </div>
                  }
                </div>
              }

              @if (assignError()) {
                <div class="assign-error">{{ assignError() }}</div>
              }

              <!-- Assign Button -->
              @if (selectedMechanicId && selectedDate && selectedStartTime && availabilityStatus() === 'available') {
                <button type="button" class="btn-assign" [disabled]="isAssigning()" (click)="createAssignment()">
                  @if (isAssigning()) {
                    <span class="spinner-sm-white"></span> Asignando...
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                    Confirmar Asignacion
                  }
                </button>
              }
            </div>
          }

          <div class="modal-footer">
            <button type="button" class="btn-close-footer" (click)="onClose()">Cerrar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-overlay { @apply fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4; }
    .modal-content { @apply bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto; }
    .modal-header { @apply flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700; }
    .modal-title { @apply text-lg font-semibold text-gray-900 dark:text-white; }
    .btn-close {
      @apply p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors;
      svg { @apply w-5 h-5; }
    }
    .order-info { @apply flex items-center justify-between px-5 py-3 bg-gray-50 dark:bg-gray-700/50; }
    .order-number { @apply text-sm font-medium text-gray-900 dark:text-white; }
    .dispatch-badge { @apply inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full; }

    .assigned-section { @apply p-5 space-y-4; }
    .assigned-header {
      @apply flex items-center gap-2 text-green-600 dark:text-green-400;
      .icon-check { @apply w-5 h-5; }
      span { @apply text-sm font-medium; }
    }
    .mechanic-info {
      @apply bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3;
      .mechanic-info-row { @apply flex items-center gap-3 mb-3; }
      .mechanic-info-text { @apply flex flex-col min-w-0; }
      .mechanic-name { @apply font-medium text-gray-900 dark:text-white text-sm; }
      .mechanic-phone { @apply text-xs text-gray-500 dark:text-gray-400; }
    }

    // ========== Schedule block (fecha + hora destacados) ==========
    .schedule-block {
      @apply rounded-lg p-3 mt-1;
      background: linear-gradient(
        135deg,
        rgba(34, 197, 94, 0.08) 0%,
        rgba(59, 130, 246, 0.08) 100%
      );
      border-left: 3px solid #22c55e;
    }

    :host-context(.dark) .schedule-block {
      background: linear-gradient(
        135deg,
        rgba(34, 197, 94, 0.12) 0%,
        rgba(59, 130, 246, 0.12) 100%
      );
      border-left-color: #4ade80;
    }

    .schedule-header {
      @apply text-[11px] font-semibold uppercase tracking-wide mb-2;
      color: #15803d;
      letter-spacing: 0.05em;
    }

    :host-context(.dark) .schedule-header { color: #4ade80; }

    .schedule-chips {
      @apply grid gap-2;
      grid-template-columns: 1fr;

      @media (min-width: 480px) {
        grid-template-columns: 1fr 1fr;
      }
    }

    .schedule-chip {
      @apply flex items-center gap-2.5 rounded-lg px-3 py-2.5;
      background-color: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(148, 163, 184, 0.25);

      svg {
        @apply flex-shrink-0;
        width: 18px;
        height: 18px;
      }

      .schedule-chip-text {
        @apply flex flex-col min-w-0;
      }

      .schedule-chip-label {
        @apply text-[10px] uppercase font-medium tracking-wide;
        color: #64748b;
      }

      .schedule-chip-value {
        @apply text-sm font-semibold truncate;
        color: #0f172a;
        text-transform: capitalize;
      }

      .schedule-chip-sep {
        @apply font-normal mx-0.5;
        color: #94a3b8;
      }
    }

    .schedule-chip-date svg { color: #16a34a; }
    .schedule-chip-time svg { color: #2563eb; }
    .schedule-chip-time .schedule-chip-value { text-transform: none; font-variant-numeric: tabular-nums; }

    :host-context(.dark) .schedule-chip {
      background-color: rgba(30, 41, 59, 0.65);
      border-color: rgba(148, 163, 184, 0.22);

      .schedule-chip-label { color: #94a3b8; }
      .schedule-chip-value { color: #f1f5f9; }
      .schedule-chip-sep { color: #64748b; }
    }

    :host-context(.dark) .schedule-chip-date svg { color: #4ade80; }
    :host-context(.dark) .schedule-chip-time svg { color: #60a5fa; }
    .magic-link-section { @apply space-y-2; }
    .link-label { @apply block text-sm font-medium text-gray-700 dark:text-gray-300; }
    .link-box { @apply flex gap-2; }
    .link-input { @apply flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs text-gray-700 dark:text-gray-300 focus:outline-none; }
    .btn-copy {
      @apply px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors;
      svg { @apply w-4 h-4 text-gray-600 dark:text-gray-400; }
    }
    .btn-whatsapp {
      @apply inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors;
      .whatsapp-icon { @apply w-5 h-5; }
    }

    .select-section { @apply p-5 space-y-5; }

    // Step Indicators
    .steps-indicator { @apply flex items-center justify-center gap-0 mb-2; }
    .step-ind {
      @apply flex flex-col items-center gap-1;
      .step-num {
        @apply w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-xs font-bold text-gray-400 dark:text-gray-500 transition-all;
        svg { @apply w-4 h-4; }
      }
      .step-text { @apply text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider; }
      &.active .step-num { @apply border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20; }
      &.active .step-text { @apply text-red-600 dark:text-red-400; }
      &.done .step-num { @apply border-green-500 bg-green-500 text-white; }
      &.done .step-text { @apply text-green-600 dark:text-green-400; }
    }
    .step-line-h {
      @apply w-10 h-0.5 bg-gray-200 dark:bg-gray-700 mb-4;
      &.done { @apply bg-green-500; }
    }

    // Step Section
    .step-section { @apply space-y-3; }
    .step-title {
      @apply flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300;
      .step-icon { @apply w-4 h-4 text-gray-400; }
    }

    .form-input {
      @apply w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-sm;
      @apply focus:outline-none focus:ring-2 focus:border-transparent;
      &:focus { --tw-ring-color: var(--accent-primary); }
    }
    .loading-assignment { @apply flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400; }
    .loading-inline { @apply flex items-center gap-2 py-3 text-sm text-gray-500 dark:text-gray-400; }
    .spinner-sm { @apply w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-red-600 rounded-full animate-spin; }

    // Empty message
    .empty-msg {
      @apply flex flex-col items-center gap-2 py-6 text-sm text-gray-400 dark:text-gray-500 text-center;
      .empty-icon { @apply w-8 h-8; }
    }

    // Mechanic Cards
    .mechanics-list { @apply space-y-2; }
    .mechanic-card-opt {
      @apply flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer transition-all;
      @apply hover:border-green-300 dark:hover:border-green-700 hover:shadow-sm;
      &.selected { @apply border-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm; }
    }
    .mech-avatar-sm {
      @apply w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0;
      svg { @apply w-5 h-5 text-gray-500 dark:text-gray-400; }
      .selected & { @apply bg-green-100 dark:bg-green-900/30; svg { @apply text-green-600 dark:text-green-400; } }
    }
    .mech-card-info {
      @apply flex flex-col flex-1 min-w-0;
      .mech-card-name { @apply text-sm font-semibold text-gray-900 dark:text-white truncate; }
      .mech-card-meta { @apply text-xs text-gray-500 dark:text-gray-400; }
    }
    .mech-check {
      @apply w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0;
      svg { @apply w-3.5 h-3.5 text-white; }
    }

    // Slots Grid
    .slots-grid { @apply grid grid-cols-2 gap-2; }
    .slot-btn {
      @apply flex items-center gap-2 p-3 border border-gray-200 dark:border-gray-600 rounded-xl cursor-pointer transition-all text-left;
      @apply hover:border-green-400 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/10 hover:shadow-sm;
      &.selected { @apply border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-400 shadow-sm; }
      &.occupied {
        @apply opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-700/30 hover:border-gray-200 dark:hover:border-gray-600 hover:bg-gray-50 hover:shadow-none;
      }
    }
    .slot-icon { @apply w-5 h-5 text-green-500 flex-shrink-0; .occupied & { @apply text-red-400; } }
    .slot-time { @apply text-sm font-medium text-gray-900 dark:text-white; }
    .slot-occupied-label { @apply text-[10px] text-red-500 font-medium; }

    // Time preview
    .time-preview {
      @apply flex items-center justify-between mt-2 px-3 py-2.5 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl;
      &.conflict { @apply bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800; }
    }
    .time-range { @apply flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white; }
    .duration-tag { @apply text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded; }
    .avail-ok { @apply flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400; }
    .avail-conflict { @apply flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400; }
    .avail-checking { @apply flex items-center gap-1 text-xs text-gray-500; }

    // Date/time validation
    .input-error { @apply border-red-500 bg-red-50 dark:bg-red-900/10 focus:ring-red-500; }
    .date-error {
      @apply flex items-center gap-2 mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs font-medium text-red-600 dark:text-red-400;
    }

    // Cancel current assignment
    .btn-cancel-current {
      @apply w-full py-2.5 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl;
      @apply hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50;
    }

    .assign-error { @apply p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg; }
    .btn-assign {
      @apply w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
    }
    .spinner-sm-white { @apply w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin; }
    .modal-footer { @apply px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end; }
    .btn-close-footer { @apply px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors; }
  `],
})
export class OrderDispatchModalComponent {
  private readonly mechanicAssignmentService = inject(MechanicAssignmentService);
  private readonly mechanicService = inject(MechanicService);

  readonly order = input<Order | null>(null);
  readonly isOpen = input<boolean>(false);
  readonly close = output<void>();
  readonly assigned = output<Order>();

  protected readonly isAssigning = signal(false);
  protected readonly isLoadingMechanics = signal(true);
  protected readonly isLoadingAssignment = signal(false);
  protected readonly assignError = signal<string | null>(null);
  protected readonly linkCopied = signal(false);
  protected readonly branchMechanics = signal<Mechanic[]>([]);
  protected readonly selectedMechanic = signal<Mechanic | null>(null);
  protected readonly currentAssignment = signal<MechanicAssignment | null>(null);
  protected readonly progressLink = signal<string>('');
  protected readonly availabilityStatus = signal<'unchecked' | 'checking' | 'available' | 'conflict' | 'outside'>('unchecked');
  protected readonly isCancellingAssignment = signal(false);

  protected selectedMechanicId = '';
  protected readonly selectedDateSignal = signal('');
  protected readonly selectedTimeSignal = signal('');
  protected readonly todayStr = new Date().toISOString().split('T')[0];

  protected get selectedDate(): string { return this.selectedDateSignal(); }
  protected set selectedDate(val: string) { this.selectedDateSignal.set(val); }
  protected get selectedStartTime(): string { return this.selectedTimeSignal(); }
  protected set selectedStartTime(val: string) { this.selectedTimeSignal.set(val); }

  protected readonly isDatePast = computed(() => {
    const d = this.selectedDateSignal();
    if (!d) return false;
    return d < this.todayStr;
  });

  protected readonly isTimeInPast = computed(() => {
    const d = this.selectedDateSignal();
    const t = this.selectedTimeSignal();
    if (!d || !t || d !== this.todayStr) return false;
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();
    return this.timeToMinutes(t) < currentMin;
  });

  protected readonly calculatedEndTime = computed(() => {
    const mech = this.selectedMechanic();
    const t = this.selectedTimeSignal();
    if (!mech || !t) return '';
    const endMin = this.timeToMinutes(t) + (mech.serviceDurationMinutes || 90);
    return this.minutesToTime(endMin);
  });

  constructor() {
    effect(() => {
      const currentOrder = this.order();
      if (currentOrder && this.isOpen()) {
        this.loadAssignment(currentOrder);
        this.loadBranchMechanics(currentOrder);
      }
    });
  }

  selectMechanic(mech: Mechanic): void {
    this.selectedMechanicId = mech.id;
    this.selectedMechanic.set(mech);
    this.selectedDate = '';
    this.selectedStartTime = '';
    this.availabilityStatus.set('unchecked');
  }

  onDateChange(): void {
    this.selectedStartTime = '';
    this.availabilityStatus.set('unchecked');
  }

  onTimeChange(): void {
    this.availabilityStatus.set('unchecked');
    this.checkTimeAvailability();
  }

  private checkTimeAvailability(): void {
    const mech = this.selectedMechanic();
    if (!mech || !this.selectedDate || !this.selectedStartTime) return;
    if (this.isDatePast() || this.isTimeInPast()) return;

    // Check if within schedule (parse parts to avoid UTC timezone shift)
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay();
    const schedule = mech.schedule?.find(s => s.day === dayOfWeek);
    if (!schedule || schedule.isClosed) {
      this.availabilityStatus.set('outside');
      return;
    }

    const startMin = this.timeToMinutes(this.selectedStartTime);
    const endMin = startMin + (mech.serviceDurationMinutes || 90);
    const openMin = this.timeToMinutes(schedule.openTime);
    const closeMin = this.timeToMinutes(schedule.closeTime);

    if (startMin < openMin || endMin > closeMin) {
      this.availabilityStatus.set('outside');
      return;
    }

    // Call backend to verify availability
    this.availabilityStatus.set('checking');
    const endTime = this.minutesToTime(endMin);

    this.mechanicAssignmentService
      .getAvailableMechanics(this.selectedDate, this.selectedStartTime, endTime, undefined, this.order()?.id)
      .subscribe({
        next: (res) => {
          const found = res.data.some(m => m.id === mech.id);
          this.availabilityStatus.set(found ? 'available' : 'conflict');
        },
        error: () => this.availabilityStatus.set('conflict'),
      });
  }

  createAssignment(): void {
    const order = this.order();
    if (!order || !this.selectedMechanicId || !this.selectedStartTime) return;

    this.isAssigning.set(true);
    this.assignError.set(null);

    this.mechanicAssignmentService.createAssignment({
      mechanicId: this.selectedMechanicId,
      orderId: order.id,
      scheduledDate: this.selectedDate,
      startTime: this.selectedStartTime,
    }).subscribe({
      next: (res) => {
        this.currentAssignment.set(res.data);
        const clientUrl = environment.clientUrl;
        this.progressLink.set(`${clientUrl}/mechanic/progress/${res.data.accessToken}`);
        this.isAssigning.set(false);
        this.assigned.emit(order);
      },
      error: (err) => {
        this.isAssigning.set(false);
        this.assignError.set(err.error?.message || 'Error al crear asignacion');
      },
    });
  }

  cancelCurrentAssignment(): void {
    const a = this.currentAssignment();
    if (!a) return;
    this.isCancellingAssignment.set(true);
    this.mechanicAssignmentService.cancelAssignment(a.id, 'Cancelado por administrador para reasignación').subscribe({
      next: () => {
        this.isCancellingAssignment.set(false);
        this.currentAssignment.set(null);
        this.progressLink.set('');
        // Reload branch mechanics for new assignment
        const order = this.order();
        if (order) this.loadBranchMechanics(order);
      },
      error: () => this.isCancellingAssignment.set(false),
    });
  }

  copyLink(): void {
    const link = this.progressLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.linkCopied.set(true);
      setTimeout(() => this.linkCopied.set(false), 2000);
    });
  }

  getAssignedMechanicName(): string {
    const a = this.currentAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.name || '';
  }

  getAssignedMechanicWhatsapp(): string {
    const a = this.currentAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.whatsapp || '';
  }

  getAssignedMechanicAvatar(): string {
    const a = this.currentAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return (a.mechanic as any).avatar || '';
  }

  getMechanicAvatar(mech: any): string {
    return mech?.avatar || '';
  }

  /**
   * Format the assignment's scheduled date in long Spanish form, e.g.
   * "Miércoles, 15 de abril de 2026". Uses the browser's Intl API with UTC
   * to avoid off-by-one shifts when the date string has no time component.
   */
  getFormattedScheduledDate(): string {
    const a = this.currentAssignment();
    if (!a?.scheduledDate) return '';
    try {
      const d = new Date(a.scheduledDate);
      const formatter = new Intl.DateTimeFormat('es-VE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      return formatter.format(d);
    } catch {
      return String(a.scheduledDate);
    }
  }

  getWhatsAppUrl(): string {
    const assignment = this.currentAssignment();
    const order = this.order();
    if (!assignment) return '';

    const mechanic = assignment.mechanic as any;
    const phone = mechanic?.whatsapp || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const link = this.progressLink();
    const clientName = order?.dispatchDetails?.recipientName || 'Cliente';
    const address = order?.dispatchDetails?.recipientAddress || '';
    const city = order?.dispatchDetails?.recipientCity || '';
    const scheduledDate = new Date(assignment.scheduledDate).toLocaleDateString('es-VE');

    const lines = [
      `*TuBus Express - Servicio de Cambio de Aceite*`,
      ``,
      `Hola ${mechanic?.name}, se te ha asignado un servicio:`,
      ``,
      `*Cliente:* ${clientName}`,
      address ? `*Direccion:* ${address}${city ? ', ' + city : ''}` : '',
      `*Fecha:* ${scheduledDate}`,
      `*Horario:* ${assignment.startTime} - ${assignment.endTime}`,
      ``,
      `*Link de progreso:*`,
      link,
    ].filter(Boolean).join('\n');

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(lines)}`;
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status as OrderStatus] || status;
  }

  getStatusColor(status: string): string {
    return ORDER_STATUS_COLORS[status as OrderStatus] || '';
  }

  onClose(): void {
    this.currentAssignment.set(null);
    this.selectedMechanic.set(null);
    this.branchMechanics.set([]);
    this.availabilityStatus.set('unchecked');
    this.selectedMechanicId = '';
    this.selectedDate = '';
    this.selectedStartTime = '';
    this.close.emit();
  }

  private loadAssignment(order: Order): void {
    const hasMechanic = order.mechanicAssignment
      || (order.mechanic && typeof order.mechanic === 'object');

    if (hasMechanic) {
      this.isLoadingAssignment.set(true);
      this.mechanicAssignmentService.getByOrder(order.id).subscribe({
        next: (res) => {
          const active = res.data.find(a => !['cancelled', 'expired'].includes(a.status));
          if (active) {
            this.currentAssignment.set(active);
            const clientUrl = environment.clientUrl;
            this.progressLink.set(`${clientUrl}/mechanic/progress/${active.accessToken}`);
          }
          this.isLoadingAssignment.set(false);
        },
        error: () => {
          this.isLoadingAssignment.set(false);
        },
      });
    }
  }

  private loadBranchMechanics(order: Order): void {
    this.isLoadingMechanics.set(true);
    const branchId = order.dispatchDetails?.selectedBranchId;

    // Load all active mechanics, optionally filtered by branch
    this.mechanicService.getAll(1, 100).subscribe({
      next: (res) => {
        let mechanics = res.data.filter(m => m.isActive);

        // Filter by branch if order has one
        if (branchId) {
          mechanics = mechanics.filter(m =>
            (m.branches || []).some(b => {
              const bid = typeof b === 'object' && b ? b.id : String(b);
              return bid === branchId;
            })
          );
        }

        this.branchMechanics.set(mechanics);
        this.isLoadingMechanics.set(false);
      },
      error: () => this.isLoadingMechanics.set(false),
    });
  }

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
}
