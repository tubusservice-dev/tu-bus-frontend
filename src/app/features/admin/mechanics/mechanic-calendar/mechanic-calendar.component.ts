import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MechanicAssignmentService } from '../../../../core/services/mechanic-assignment.service';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { Mechanic, DateBlock } from '../../../../models/mechanic.model';
import { MechanicAssignment } from '../../../../models/mechanic-assignment.model';
import { DateBlockModalComponent } from '../date-block-modal/date-block-modal.component';
import { MechanicAvatarComponent } from '../../../../shared/components/mechanic-avatar/mechanic-avatar.component';

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isClosed: boolean;
  assignments: MechanicAssignment[];
  isBlocked: boolean;
  blockReason?: string;
  totalSlots: number;
  usedSlots: number;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  status: 'available' | 'assigned' | 'blocked' | 'closed';
  assignment?: MechanicAssignment;
}

interface WeekDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  isClosed: boolean;
  isBlocked: boolean;
  slots: TimeSlot[];
}

@Component({
  selector: 'app-mechanic-calendar',
  standalone: true,
  imports: [CommonModule, RouterLink, DateBlockModalComponent, MechanicAvatarComponent],
  templateUrl: './mechanic-calendar.component.html',
  styleUrl: './mechanic-calendar.component.scss',
})
export class MechanicCalendarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly mechanicAssignmentService = inject(MechanicAssignmentService);
  private readonly mechanicService = inject(MechanicService);

  protected readonly mechanicId = signal<string>('');
  protected readonly mechanic = signal<Mechanic | null>(null);
  protected readonly assignments = signal<MechanicAssignment[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly currentYear = signal(new Date().getFullYear());
  protected readonly currentMonth = signal(new Date().getMonth() + 1);
  protected readonly selectedDay = signal<CalendarDay | null>(null);
  protected readonly showDateBlockModal = signal(false);
  protected readonly viewMode = signal<'month' | 'week'>('month');
  protected readonly currentWeekStart = signal<Date>(this.getMonday(new Date()));

  protected readonly weekDayHeaders = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
  protected readonly fullDayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

  protected readonly monthName = computed(() => {
    const date = new Date(this.currentYear(), this.currentMonth() - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  });

  protected readonly weekLabel = computed(() => {
    const start = this.currentWeekStart();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' })}`;
    return `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}`;
  });

  // --- MONTHLY VIEW ---
  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const mech = this.mechanic();
    const assigns = this.assignments();
    const year = this.currentYear();
    const month = this.currentMonth() - 1;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const days: CalendarDay[] = [];
    const today = new Date();

    for (let i = startDay - 1; i >= 0; i--) {
      days.push(this.buildCalendarDay(new Date(year, month, -i), false, mech, assigns, today));
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(this.buildCalendarDay(new Date(year, month, d), true, mech, assigns, today));
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push(this.buildCalendarDay(new Date(year, month + 1, d), false, mech, assigns, today));
    }
    return days;
  });

  protected readonly selectedDaySlots = computed<TimeSlot[]>(() => {
    const day = this.selectedDay();
    const mech = this.mechanic();
    if (!day || !mech) return [];
    return this.buildSlotsForDay(day.date, day.assignments, mech);
  });

  // --- WEEKLY VIEW ---
  protected readonly weekDays = computed<WeekDay[]>(() => {
    const start = this.currentWeekStart();
    const mech = this.mechanic();
    const assigns = this.assignments();
    if (!mech) return [];

    const today = new Date();
    const days: WeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);

      const dayOfWeek = date.getDay();
      const schedule = mech.schedule?.find(s => s.day === dayOfWeek);
      const isClosed = schedule ? schedule.isClosed : true;

      const dateStr = date.toISOString().split('T')[0];
      const dayAssignments = assigns.filter(a => {
        const aDate = new Date(a.scheduledDate).toISOString().split('T')[0];
        return aDate === dateStr && a.status !== 'cancelled';
      });

      const isBlocked = (mech.dateBlocks || []).some(block => {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const bs = new Date(new Date(block.startDate).getFullYear(), new Date(block.startDate).getMonth(), new Date(block.startDate).getDate()).getTime();
        const be = new Date(new Date(block.endDate).getFullYear(), new Date(block.endDate).getMonth(), new Date(block.endDate).getDate()).getTime();
        return d >= bs && d <= be && block.isAllDay;
      });

      const slots = isClosed || isBlocked ? [] : this.buildSlotsForDay(date, dayAssignments, mech);

      days.push({
        date,
        dayName: this.fullDayNames[dayOfWeek],
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('es-ES', { month: 'short' }),
        isToday: date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(),
        isClosed,
        isBlocked,
        slots,
      });
    }
    return days;
  });

  protected readonly weekTimeLabels = computed<string[]>(() => {
    const mech = this.mechanic();
    if (!mech) return [];
    let earliest = 24 * 60;
    let latest = 0;
    for (const day of mech.schedule || []) {
      if (day.isClosed) continue;
      const open = this.timeToMinutes(day.openTime);
      const close = this.timeToMinutes(day.closeTime);
      if (open < earliest) earliest = open;
      if (close > latest) latest = close;
    }
    if (earliest >= latest) return [];
    const labels: string[] = [];
    for (let m = earliest; m < latest; m += 60) {
      labels.push(this.minutesToTime(m));
    }
    return labels;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mechanicId.set(id);
      this.loadCalendar();
    }
  }

  toggleView(): void {
    this.viewMode.update(v => v === 'month' ? 'week' : 'month');
    this.loadCalendar();
  }

  // Month navigation
  prevMonth(): void {
    if (this.currentMonth() === 1) {
      this.currentMonth.set(12);
      this.currentYear.update(y => y - 1);
    } else {
      this.currentMonth.update(m => m - 1);
    }
    this.selectedDay.set(null);
    this.loadCalendar();
  }

  nextMonth(): void {
    if (this.currentMonth() === 12) {
      this.currentMonth.set(1);
      this.currentYear.update(y => y + 1);
    } else {
      this.currentMonth.update(m => m + 1);
    }
    this.selectedDay.set(null);
    this.loadCalendar();
  }

  // Week navigation
  prevWeek(): void {
    const d = new Date(this.currentWeekStart());
    d.setDate(d.getDate() - 7);
    this.currentWeekStart.set(d);
    this.syncMonthFromWeek(d);
    this.loadCalendar();
  }

  nextWeek(): void {
    const d = new Date(this.currentWeekStart());
    d.setDate(d.getDate() + 7);
    this.currentWeekStart.set(d);
    this.syncMonthFromWeek(d);
    this.loadCalendar();
  }

  goToToday(): void {
    const today = new Date();
    this.currentWeekStart.set(this.getMonday(today));
    this.currentMonth.set(today.getMonth() + 1);
    this.currentYear.set(today.getFullYear());
    this.selectedDay.set(null);
    this.loadCalendar();
  }

  selectDay(day: CalendarDay): void {
    if (!day.isCurrentMonth) return;
    this.selectedDay.set(day);
  }

  getOrderNumber(assignment: MechanicAssignment): string {
    if (typeof assignment.order === 'object' && assignment.order) {
      return (assignment.order as any).orderNumber || '';
    }
    return '';
  }

  getStatusClass(assignment: MechanicAssignment): string {
    const map: Record<string, string> = {
      scheduled: 'status-scheduled',
      en_camino: 'status-en-camino',
      in_progress: 'status-in-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
      expired: 'status-expired',
      paused: 'status-paused',
    };
    return map[assignment.status] || '';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      scheduled: 'Programado',
      en_camino: 'En Camino',
      in_progress: 'En Servicio',
      completed: 'Completado',
      cancelled: 'Cancelado',
      expired: 'Expirada',
      paused: 'En Pausa',
    };
    return labels[status] || status;
  }

  openDateBlockModal(): void {
    this.showDateBlockModal.set(true);
  }

  onDateBlockSaved(updatedMechanic: Mechanic): void {
    this.mechanic.set(updatedMechanic);
    this.showDateBlockModal.set(false);
  }

  removeDateBlock(index: number): void {
    const id = this.mechanicId();
    if (!id) return;
    this.mechanicService.removeDateBlock(id, index).subscribe({
      next: (res) => this.mechanic.set(res.data),
    });
  }

  getSlotTopPercent(slot: TimeSlot): number {
    const labels = this.weekTimeLabels();
    if (labels.length === 0) return 0;
    const earliest = this.timeToMinutes(labels[0]);
    const latest = this.timeToMinutes(labels[labels.length - 1]) + 60;
    const slotStart = this.timeToMinutes(slot.startTime);
    return ((slotStart - earliest) / (latest - earliest)) * 100;
  }

  getSlotHeightPercent(slot: TimeSlot): number {
    const labels = this.weekTimeLabels();
    if (labels.length === 0) return 0;
    const earliest = this.timeToMinutes(labels[0]);
    const latest = this.timeToMinutes(labels[labels.length - 1]) + 60;
    const duration = this.timeToMinutes(slot.endTime) - this.timeToMinutes(slot.startTime);
    return (duration / (latest - earliest)) * 100;
  }

  // --- PRIVATE ---
  private loadCalendar(): void {
    this.isLoading.set(true);
    const id = this.mechanicId();

    if (this.viewMode() === 'week') {
      // For week view: load via date range to handle cross-month weeks
      const start = this.currentWeekStart();
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      this.mechanicAssignmentService.getByMechanic(id, startStr, endStr).subscribe({
        next: (res) => {
          this.assignments.set(res.data);
          this.isLoading.set(false);
        },
        error: (err: any) => {
          console.error('Error loading mechanic week data:', err);
          this.isLoading.set(false);
        },
      });

      // Also load mechanic info if not already loaded
      if (!this.mechanic()) {
        this.mechanicService.getById(id).subscribe({
          next: (res) => this.mechanic.set(res.data),
        });
      }
    } else {
      // Monthly view: load full calendar
      this.mechanicAssignmentService
        .getMechanicCalendar(id, this.currentMonth(), this.currentYear())
        .subscribe({
          next: (res) => {
            this.mechanic.set(res.data.mechanic);
            this.assignments.set(res.data.assignments);
            this.isLoading.set(false);
          },
          error: (err: any) => {
            console.error('Error loading mechanic calendar:', err);
            this.isLoading.set(false);
          },
        });
    }
  }

  private buildSlotsForDay(date: Date, dayAssignments: MechanicAssignment[], mech: Mechanic): TimeSlot[] {
    const dayOfWeek = date.getDay();
    const schedule = mech.schedule?.find(s => s.day === dayOfWeek);
    if (!schedule || schedule.isClosed) return [];

    const openMin = this.timeToMinutes(schedule.openTime);
    const closeMin = this.timeToMinutes(schedule.closeTime);

    // Sort assignments by startTime
    const sorted = [...dayAssignments]
      .filter(a => a.status !== 'cancelled')
      .sort((a, b) => this.timeToMinutes(a.startTime) - this.timeToMinutes(b.startTime));

    const slots: TimeSlot[] = [];
    let cursor = openMin;

    for (const a of sorted) {
      const aStart = this.timeToMinutes(a.startTime);
      const aEnd = this.timeToMinutes(a.endTime);

      // Free gap before this assignment
      if (aStart > cursor) {
        slots.push({
          startTime: this.minutesToTime(cursor),
          endTime: this.minutesToTime(aStart),
          status: 'available',
        });
      }

      // The assignment block
      slots.push({
        startTime: a.startTime,
        endTime: a.endTime,
        status: 'assigned',
        assignment: a,
      });

      cursor = Math.max(cursor, aEnd);
    }

    // Free gap after last assignment until close
    if (cursor < closeMin) {
      slots.push({
        startTime: this.minutesToTime(cursor),
        endTime: this.minutesToTime(closeMin),
        status: 'available',
      });
    }

    return slots;
  }

  private buildCalendarDay(
    date: Date, isCurrentMonth: boolean, mechanic: Mechanic | null,
    assignments: MechanicAssignment[], today: Date
  ): CalendarDay {
    const dayOfWeek = date.getDay();
    const schedule = mechanic?.schedule?.find(s => s.day === dayOfWeek);
    const isClosed = schedule ? schedule.isClosed : false;

    const dateStr = date.toISOString().split('T')[0];
    const dayAssignments = assignments.filter(a => {
      const aDate = new Date(a.scheduledDate).toISOString().split('T')[0];
      return aDate === dateStr && a.status !== 'cancelled';
    });

    const isBlocked = (mechanic?.dateBlocks || []).some(block => {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const bs = new Date(new Date(block.startDate).getFullYear(), new Date(block.startDate).getMonth(), new Date(block.startDate).getDate()).getTime();
      const be = new Date(new Date(block.endDate).getFullYear(), new Date(block.endDate).getMonth(), new Date(block.endDate).getDate()).getTime();
      return d >= bs && d <= be && block.isAllDay;
    });

    const blockInfo = (mechanic?.dateBlocks || []).find(block => {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const bs = new Date(new Date(block.startDate).getFullYear(), new Date(block.startDate).getMonth(), new Date(block.startDate).getDate()).getTime();
      const be = new Date(new Date(block.endDate).getFullYear(), new Date(block.endDate).getMonth(), new Date(block.endDate).getDate()).getTime();
      return d >= bs && d <= be;
    });

    // Capacity calculation
    const totalSlots = 0; // Not used with free-form scheduling
    const usedSlots = dayAssignments.length;

    return {
      date, dayNumber: date.getDate(), isCurrentMonth,
      isToday: date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(),
      isClosed, assignments: dayAssignments, isBlocked,
      blockReason: blockInfo?.reason, totalSlots, usedSlots,
    };
  }

  private syncMonthFromWeek(weekStart: Date): void {
    const mid = new Date(weekStart);
    mid.setDate(mid.getDate() + 3);
    this.currentMonth.set(mid.getMonth() + 1);
    this.currentYear.set(mid.getFullYear());
  }

  private getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
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

  private isTimeOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
    return this.timeToMinutes(s1) < this.timeToMinutes(e2) && this.timeToMinutes(s2) < this.timeToMinutes(e1);
  }

  private isSlotBlocked(date: Date, startTime: string, endTime: string, blocks: DateBlock[]): boolean {
    return blocks.some(block => {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const bs = new Date(new Date(block.startDate).getFullYear(), new Date(block.startDate).getMonth(), new Date(block.startDate).getDate()).getTime();
      const be = new Date(new Date(block.endDate).getFullYear(), new Date(block.endDate).getMonth(), new Date(block.endDate).getDate()).getTime();
      if (d < bs || d > be) return false;
      if (block.isAllDay) return true;
      if (block.startTime && block.endTime) return this.isTimeOverlap(startTime, endTime, block.startTime, block.endTime);
      return true;
    });
  }
}
