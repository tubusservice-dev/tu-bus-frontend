import { Component, inject, signal, OnInit, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryService } from '../../../../core/services/category.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { VehicleType, VEHICLE_TYPE_LABELS } from '../../../../models';

interface VehicleTypeOption {
  value: VehicleType;
  label: string;
}

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
})
export class CategoryFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly elementRef = inject(ElementRef);

  protected readonly categoryId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Vehicle types multi-select
  protected readonly selectedVehicleTypes = signal<VehicleTypeOption[]>([]);
  protected readonly vehicleTypeSearchTerm = signal('');
  protected readonly showVehicleTypeDropdown = signal(false);
  protected readonly vehicleTypeTouched = signal(false);

  // Universal flag — when true, category applies to every vehicle type
  // and selectedVehicleTypes is bypassed (persisted as [VehicleType.ALL]).
  protected readonly isUniversal = signal(false);

  // All available options (exclude 'all' — categories must target specific types)
  private readonly allVehicleTypeOptions: VehicleTypeOption[] = Object.entries(VEHICLE_TYPE_LABELS)
    .filter(([key]) => key !== VehicleType.ALL)
    .map(([value, label]) => ({ value: value as VehicleType, label }));

  // Filtered options (exclude already selected, apply search)
  protected readonly filteredVehicleTypes = computed(() => {
    const search = this.vehicleTypeSearchTerm().toLowerCase().trim();
    const selectedValues = new Set(this.selectedVehicleTypes().map(s => s.value));

    let filtered = this.allVehicleTypeOptions.filter(o => !selectedValues.has(o.value));

    if (search) {
      filtered = filtered.filter(o => o.label.toLowerCase().includes(search));
    }

    return filtered;
  });

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.categoryId.set(id);
      this.isEditMode.set(true);
      this.loadCategory(id);
    }
  }

  private loadCategory(id: string): void {
    this.isLoading.set(true);
    this.categoryService.getById(id).subscribe({
      next: (response) => {
        const category = response.data;
        this.form.patchValue({
          name: category.name,
          description: category.description || '',
          isActive: category.isActive,
        });

        // Load selected vehicle types — detect universal mode first
        if (category.vehicleTypes?.includes(VehicleType.ALL)) {
          this.isUniversal.set(true);
          this.selectedVehicleTypes.set([]);
        } else if (category.vehicleTypes?.length) {
          const selected = category.vehicleTypes
            .filter((vt: VehicleType) => vt !== VehicleType.ALL)
            .map((vt: VehicleType) => ({
              value: vt,
              label: VEHICLE_TYPE_LABELS[vt] || vt,
            }));
          this.selectedVehicleTypes.set(selected);
        }

        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar categoría');
        this.isLoading.set(false);
      },
    });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.vehicleTypeTouched.set(true);

    const needsSelection = !this.isUniversal() && this.selectedVehicleTypes().length === 0;
    if (this.form.invalid || needsSelection) {
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const data = {
      ...this.form.value,
      vehicleTypes: this.isUniversal()
        ? [VehicleType.ALL]
        : this.selectedVehicleTypes().map(vt => vt.value),
    };

    const request$ = this.isEditMode()
      ? this.categoryService.update(this.categoryId()!, data)
      : this.categoryService.create(data);

    request$.subscribe({
      next: () => {
        this.toastService.success(
          this.isEditMode() ? 'Categoría actualizada exitosamente' : 'Categoría creada exitosamente',
        );
        this.router.navigate(['/admin/categories']);
      },
      error: (error) => {
        const msg = error.error?.message || 'Error al guardar categoría';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
        this.isSubmitting.set(false);
      },
    });
  }

  // ==================== VEHICLE TYPES MULTI-SELECT ====================

  /**
   * Toggle universal mode. When ON, the category targets every vehicle type
   * and the multi-select is cleared + hidden. When OFF, the user must pick
   * at least one specific type (existing validation applies).
   */
  onUniversalToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.isUniversal.set(checked);

    if (checked) {
      this.selectedVehicleTypes.set([]);
      this.vehicleTypeSearchTerm.set('');
      this.showVehicleTypeDropdown.set(false);
      this.vehicleTypeTouched.set(false);
    }
  }

  onVehicleTypeSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.vehicleTypeSearchTerm.set(input.value);
    this.showVehicleTypeDropdown.set(true);
  }

  openVehicleTypeDropdown(): void {
    this.showVehicleTypeDropdown.set(true);
    this.vehicleTypeTouched.set(true);
  }

  selectVehicleType(option: VehicleTypeOption): void {
    this.selectedVehicleTypes.update(list => [...list, option]);
    this.vehicleTypeSearchTerm.set('');
    this.showVehicleTypeDropdown.set(false);
  }

  removeVehicleType(option: VehicleTypeOption): void {
    this.selectedVehicleTypes.update(list => list.filter(vt => vt.value !== option.value));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const selector = this.elementRef.nativeElement.querySelector('.vehicle-type-selector');
    if (selector && !selector.contains(target)) {
      this.showVehicleTypeDropdown.set(false);
    }
  }

  // ==================== HELPERS ====================

  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }
}
