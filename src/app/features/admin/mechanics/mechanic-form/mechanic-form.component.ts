import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { BranchService } from '../../../../core/services/branch.service';
import { UploadService } from '../../../../core/services/upload.service';
import { ScheduleDay } from '../../../../models/mechanic.model';
import {
  NAME_PATTERN, EMAIL_PATTERN, MAX_NAME_LENGTH, noNumbersValidator, venezuelanPhoneValidator,
} from '../../../../shared/validators/form-validators';
import { toVenezuelanE164 } from '../../../../shared/utils/phone.util';
import { MechanicAvatarComponent } from '../../../../shared/components/mechanic-avatar/mechanic-avatar.component';
import { ToastService } from '../../../../shared/services/toast.service';

interface BranchItem {
  id: string;
  name: string;
  address: string;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

@Component({
  selector: 'app-mechanic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MechanicAvatarComponent],
  templateUrl: './mechanic-form.component.html',
  styleUrl: './mechanic-form.component.scss',
})
export class MechanicFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly mechanicService = inject(MechanicService);
  private readonly branchService = inject(BranchService);
  private readonly uploadService = inject(UploadService);
  private readonly toastService = inject(ToastService);

  // ===== Avatar upload =====
  protected readonly avatarUrl = signal<string>('');
  protected readonly avatarPreview = signal<string | null>(null);
  protected readonly avatarFile = signal<File | null>(null);
  protected readonly isUploadingAvatar = signal(false);
  protected readonly avatarError = signal<string | null>(null);

  protected readonly mechanicId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Branch search + select
  protected readonly availableBranches = signal<BranchItem[]>([]);
  protected readonly selectedBranches = signal<BranchItem[]>([]);
  protected readonly branchSearchTerm = signal('');
  protected readonly showBranchDropdown = signal(false);

  protected readonly filteredBranches = computed(() => {
    const term = this.branchSearchTerm().toLowerCase();
    const selectedIds = new Set(this.selectedBranches().map(b => b.id));
    return this.availableBranches()
      .filter(b => !selectedIds.has(b.id))
      .filter(b => !term || b.name.toLowerCase().includes(term) || b.address.toLowerCase().includes(term));
  });

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_NAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
    whatsapp: ['', [Validators.required, venezuelanPhoneValidator]],
    email: ['', [Validators.pattern(EMAIL_PATTERN)]],
    serviceDurationMinutes: [90, [Validators.required, Validators.min(15), Validators.max(720)]],
    schedule: this.fb.array([]),
  });

  get scheduleArray(): FormArray {
    return this.form.get('schedule') as FormArray;
  }

  ngOnInit(): void {
    this.loadBranches();
    this.initSchedule();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mechanicId.set(id);
      this.isEditMode.set(true);
      this.loadMechanic(id);
    }
  }

  private initSchedule(): void {
    const arr = this.scheduleArray;
    arr.clear();
    DAY_NAMES.forEach((dayName, index) => {
      arr.push(this.fb.group({
        day: [index], dayName: [dayName],
        openTime: ['08:00'], closeTime: ['18:00'],
        isClosed: [index === 0 || index === 6],
      }));
    });
  }

  private loadBranches(): void {
    this.branchService.getAll().subscribe({
      next: (res) => {
        this.availableBranches.set(
          res.data.filter((b: any) => b.isActive).map((b: any) => ({
            id: b.id, name: b.name, address: b.address || '',
          }))
        );
      },
      error: () => {},
    });
  }

  private loadMechanic(id: string): void {
    this.isLoading.set(true);
    this.mechanicService.getById(id).subscribe({
      next: (res) => {
        const m = res.data;

        // Map branches to BranchItem[]
        const branches: BranchItem[] = (m.branches || []).map((b: any) => {
          if (typeof b === 'object' && b) return { id: b.id, name: b.name, address: b.address || '' };
          return { id: String(b), name: String(b), address: '' };
        });
        this.selectedBranches.set(branches);
        this.avatarUrl.set(m.avatar || '');

        this.form.patchValue({
          name: m.name, whatsapp: m.whatsapp || '', email: m.email || '',
          serviceDurationMinutes: m.serviceDurationMinutes || 2,
        });

        if (m.schedule?.length > 0) {
          const arr = this.scheduleArray;
          arr.clear();
          m.schedule.forEach((d: ScheduleDay) => {
            arr.push(this.fb.group({
              day: [d.day], dayName: [d.dayName],
              openTime: [d.openTime], closeTime: [d.closeTime], isClosed: [d.isClosed],
            }));
          });
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.error?.message || 'Error al cargar mecanico');
        this.isLoading.set(false);
      },
    });
  }

  // Branch search handlers
  onBranchSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.branchSearchTerm.set(value);
    this.showBranchDropdown.set(true);
  }

  onBranchInputFocus(): void {
    this.showBranchDropdown.set(true);
  }

  onBranchInputBlur(): void {
    // Delay to allow click on dropdown items
    setTimeout(() => this.showBranchDropdown.set(false), 200);
  }

  addBranch(branch: BranchItem): void {
    this.selectedBranches.update(list => [...list, branch]);
    this.branchSearchTerm.set('');
    this.showBranchDropdown.set(false);
  }

  removeBranch(branchId: string): void {
    this.selectedBranches.update(list => list.filter(b => b.id !== branchId));
  }

  // ===== Avatar handlers =====

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Basic validation: image type + size cap 5MB
    if (!file.type.startsWith('image/')) {
      this.avatarError.set('El archivo debe ser una imagen');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('La imagen no puede superar 5MB');
      return;
    }

    this.avatarError.set(null);
    this.avatarFile.set(file);

    // Local preview via FileReader — no upload yet, that happens on submit
    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(reader.result as string);
    reader.readAsDataURL(file);

    // Allow re-selecting the same file
    input.value = '';
  }

  removeAvatar(): void {
    this.avatarUrl.set('');
    this.avatarFile.set(null);
    this.avatarPreview.set(null);
    this.avatarError.set(null);
  }

  /** URL used by the preview — local preview trumps the remote one */
  get previewAvatarUrl(): string {
    return this.avatarPreview() || this.avatarUrl();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    // Upload the avatar first (if any new file was selected), then persist
    const file = this.avatarFile();
    if (file) {
      this.isUploadingAvatar.set(true);
      this.uploadService.uploadImage(file, 'mechanics').subscribe({
        next: (res) => {
          this.avatarUrl.set(res.data.url);
          this.isUploadingAvatar.set(false);
          this.avatarFile.set(null);
          this.persistMechanic();
        },
        error: (err) => {
          this.isUploadingAvatar.set(false);
          this.isSubmitting.set(false);
          this.errorMessage.set(err.error?.message || 'Error al subir la foto');
        },
      });
    } else {
      this.persistMechanic();
    }
  }

  private persistMechanic(): void {
    const val = this.form.value;
    const data = {
      name: val.name,
      whatsapp: toVenezuelanE164(val.whatsapp),
      email: val.email || undefined,
      avatar: this.avatarUrl() || undefined,
      branches: this.selectedBranches().map(b => b.id),
      serviceDurationMinutes: val.serviceDurationMinutes,
      schedule: val.schedule,
    };

    const req$ = this.isEditMode()
      ? this.mechanicService.update(this.mechanicId()!, data)
      : this.mechanicService.create(data);

    req$.subscribe({
      next: () => {
        this.toastService.success(
          this.isEditMode()
            ? 'Mecánico actualizado exitosamente'
            : 'Mecánico creado exitosamente',
        );
        this.router.navigate(['/admin/mechanics']);
      },
      error: (err) => {
        const msg = err.error?.message || 'Error al guardar mecanico';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
        this.isSubmitting.set(false);
      },
    });
  }

  hasError(field: string, error: string): boolean {
    const c = this.form.get(field);
    return !!(c?.hasError(error) && c?.touched);
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(c?.invalid && c?.touched);
  }
}
