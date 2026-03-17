import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BrandService } from '../../../../core/services/brand.service';
import { UploadService } from '../../../../core/services/upload.service';

@Component({
  selector: 'app-brand-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './brand-form.component.html',
  styleUrl: './brand-form.component.scss',
})
export class BrandFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly brandService = inject(BrandService);
  private readonly uploadService = inject(UploadService);

  protected readonly brandId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly imagePreview = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    image: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.brandId.set(id);
      this.isEditMode.set(true);
      this.loadBrand(id);
    }
  }

  private loadBrand(id: string): void {
    this.isLoading.set(true);
    this.brandService.getById(id).subscribe({
      next: (response) => {
        const brand = response.data;
        this.form.patchValue({
          name: brand.name,
          description: brand.description || '',
          image: brand.image || '',
          isActive: brand.isActive,
        });
        if (brand.image) {
          this.imagePreview.set(brand.image);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar marca');
        this.isLoading.set(false);
      },
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.isUploading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await this.uploadService.uploadImage(file, 'brands').toPromise();
      if (response?.data?.url) {
        this.form.patchValue({ image: response.data.url });
        this.imagePreview.set(response.data.url);
      }
    } catch (error: any) {
      this.errorMessage.set(error.error?.message || 'Error al subir imagen');
    }

    this.isUploading.set(false);
    input.value = '';
  }

  removeImage(): void {
    this.form.patchValue({ image: '' });
    this.imagePreview.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const data = this.form.value;

    const request$ = this.isEditMode()
      ? this.brandService.update(this.brandId()!, data)
      : this.brandService.create(data);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/admin/brands']);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar marca');
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
