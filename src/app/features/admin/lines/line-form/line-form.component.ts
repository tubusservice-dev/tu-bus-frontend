import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LineService } from '../../../../core/services/line.service';
import { UploadService } from '../../../../core/services/upload.service';
import { ToastService } from '../../../../shared/services/toast.service';

@Component({
  selector: 'app-line-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './line-form.component.html',
  styleUrl: './line-form.component.scss',
})
export class LineFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly lineService = inject(LineService);
  private readonly uploadService = inject(UploadService);
  private readonly toastService = inject(ToastService);

  protected readonly lineId = signal<string | null>(null);
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
      this.lineId.set(id);
      this.isEditMode.set(true);
      this.loadLine(id);
    }
  }

  private loadLine(id: string): void {
    this.isLoading.set(true);
    this.lineService.getById(id).subscribe({
      next: (response) => {
        const line = response.data;
        this.form.patchValue({
          name: line.name,
          description: line.description || '',
          image: line.image || '',
          isActive: line.isActive,
        });
        if (line.image) {
          this.imagePreview.set(line.image);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar línea');
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
      const response = await this.uploadService.uploadImage(file, 'lines').toPromise();
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
      ? this.lineService.update(this.lineId()!, data)
      : this.lineService.create(data);

    request$.subscribe({
      next: () => {
        this.toastService.success(
          this.isEditMode() ? 'Línea actualizada exitosamente' : 'Línea creada exitosamente',
        );
        this.router.navigate(['/admin/lines']);
      },
      error: (error) => {
        const msg = error.error?.message || 'Error al guardar línea';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
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
