import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { ZoneService } from '../../../../core/services/zone.service';
import { Zone } from '../../../../models/zone.model';
import { City } from '../../../../models/city.model';

@Component({
  selector: 'app-mechanic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './mechanic-form.component.html',
  styleUrl: './mechanic-form.component.scss',
})
export class MechanicFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly mechanicService = inject(MechanicService);
  private readonly zoneService = inject(ZoneService);

  protected readonly mechanicId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly zones = signal<Zone[]>([]);
  protected readonly selectedZoneId = signal<string>('');

  protected readonly availableMunicipalities = computed<Array<{ slug: string; name: string }>>(() => {
    const zoneId = this.selectedZoneId();
    if (!zoneId) return [];
    const zone = this.zones().find(z => z.id === zoneId);
    if (!zone) return [];

    // Resolve slugs to display names from the city reference
    const city = zone.city as City;
    if (!city || typeof city === 'string') {
      return zone.municipalities.map(slug => ({ slug, name: slug }));
    }

    return zone.municipalities.map(slug => {
      const found = city.municipalities?.find(m => m.slug === slug);
      return { slug, name: found?.name || slug };
    });
  });

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    whatsapp: ['', [Validators.required]],
    email: ['', [Validators.email]],
    zone: [''],
    municipality: [''],
  });

  ngOnInit(): void {
    this.loadZones();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.mechanicId.set(id);
      this.isEditMode.set(true);
      this.loadMechanic(id);
    }
  }

  private loadZones(): void {
    this.zoneService.getAllAdmin().subscribe({
      next: (response) => {
        this.zones.set(response.data);
      },
      error: () => {
        // Zones are optional, silently fail
      },
    });
  }

  private loadMechanic(id: string): void {
    this.isLoading.set(true);
    this.mechanicService.getById(id).subscribe({
      next: (response) => {
        const mechanic = response.data;
        const zoneId = typeof mechanic.zone === 'object' && mechanic.zone ? mechanic.zone.id : (mechanic.zone || '');
        this.selectedZoneId.set(zoneId);
        this.form.patchValue({
          name: mechanic.name,
          whatsapp: mechanic.whatsapp || '',
          email: mechanic.email || '',
          zone: zoneId,
          municipality: mechanic.municipality || '',
        });
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar mecanico');
        this.isLoading.set(false);
      },
    });
  }

  onZoneChange(event: Event): void {
    const zoneId = (event.target as HTMLSelectElement).value;
    this.selectedZoneId.set(zoneId);
    this.form.patchValue({ municipality: '' });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.value;
    const data = {
      name: formValue.name,
      whatsapp: formValue.whatsapp,
      email: formValue.email || undefined,
      zone: formValue.zone || undefined,
      municipality: formValue.municipality || undefined,
    };

    const request$ = this.isEditMode()
      ? this.mechanicService.update(this.mechanicId()!, data)
      : this.mechanicService.create(data);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/admin/mechanics']);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar mecanico');
        this.isSubmitting.set(false);
      },
    });
  }

  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }
}
