import { Component, inject, input, model, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';
import { UploadService } from '@core/services/upload.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { FloatingStat, HeroImage } from '@models/settings.model';

/**
 * "Imágenes del Hero" section: banner images (upload, reorder, delete), the
 * floating stat cards and the banner carousel. The parent owns the forms and
 * the image list; this component edits and saves them.
 */
@Component({
  selector: 'app-hero-images-settings',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './hero-images-settings.component.html',
  styleUrl: './hero-images-settings.component.scss',
})
export class HeroImagesSettingsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly uploadService = inject(UploadService);

  readonly floatingStatsForm = input.required<FormGroup>();
  readonly heroImagesCarouselForm = input.required<FormGroup>();
  readonly heroImages = model.required<HeroImage[]>();

  protected readonly isUploadingHeroImage = signal(false);
  protected readonly heroImagePreview = signal<string | null>(null);

  protected readonly isSaving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Banner image awaiting confirmation; `null` closes the dialog. Deleting one
   *  hits Cloudinary immediately and cannot be undone, hence the prompt. */
  protected readonly heroImageToRemove = signal<number | null>(null);

  protected onHeroImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.heroImages().length >= 5) {
      this.errorMessage.set('Máximo 5 imágenes permitidas');
      input.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage.set('Solo se permiten archivos de imagen');
      input.value = '';
      return;
    }

    this.isUploadingHeroImage.set(true);
    this.clearMessages();

    this.uploadService.uploadImage(file, 'hero').subscribe({
      next: (response) => {
        const newImage: HeroImage = {
          url: response.data.url,
          publicId: response.data.publicId,
          order: this.heroImages().length,
        };
        this.heroImages.update((images) => [...images, newImage]);
        this.isUploadingHeroImage.set(false);
        input.value = '';
      },
      error: (error) => {
        this.isUploadingHeroImage.set(false);
        this.errorMessage.set(error.error?.message || 'Error al subir imagen');
        input.value = '';
      },
    });
  }

  protected askRemoveHeroImage(index: number): void { this.heroImageToRemove.set(index); }
  protected cancelRemoveHeroImage(): void { this.heroImageToRemove.set(null); }

  protected confirmRemoveHeroImage(): void {
    const index = this.heroImageToRemove();
    if (index === null) return;
    this.heroImageToRemove.set(null);
    this.removeHeroImage(index);
  }

  private removeHeroImage(index: number): void {
    const image = this.heroImages()[index];
    if (!image) return;

    this.uploadService.deleteImage(image.publicId).subscribe({
      next: () => {
        this.heroImages.update((images) => {
          const updated = images.filter((_, i) => i !== index);
          return updated.map((img, i) => ({ ...img, order: i }));
        });
      },
      error: () => {
        // Remove from local state even if Cloudinary delete fails
        this.heroImages.update((images) => {
          const updated = images.filter((_, i) => i !== index);
          return updated.map((img, i) => ({ ...img, order: i }));
        });
      },
    });
  }

  protected moveHeroImage(index: number, direction: 'up' | 'down'): void {
    const images = [...this.heroImages()];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= images.length) return;

    [images[index], images[targetIndex]] = [images[targetIndex], images[index]];
    this.heroImages.set(images.map((img, i) => ({ ...img, order: i })));
  }

  protected isAutoRating(): boolean {
    return this.floatingStatsForm().get('stat2.source')?.value === 'reviews_average';
  }

  protected toggleAutoRating(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.floatingStatsForm().get('stat2.source')?.setValue(checked ? 'reviews_average' : 'manual');
  }

  protected saveHeroImages(): void {
    const statsForm = this.floatingStatsForm();
    if (statsForm.invalid) {
      statsForm.markAllAsTouched();
      this.errorMessage.set('Revisa los campos de los indicadores flotantes');
      return;
    }

    this.isSaving.set(true);
    this.clearMessages();

    const stat1 = statsForm.get('stat1')?.value;
    const stat2 = statsForm.get('stat2')?.value;

    // Labels are hardcoded on the landing, but the backend schema requires
    // the field — we inject a fixed placeholder to satisfy validation.
    const floatingStats: FloatingStat[] = [
      { ...stat1, label: 'Servicios', position: 'left' as const, source: 'manual' as const },
      { ...stat2, label: 'Valoración', position: 'right' as const },
    ];

    const payload = {
      images: this.heroImages(),
      carousel: this.heroImagesCarouselForm().value,
      floatingStats,
    };

    this.settingsService.updateHeroImages(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(error.error?.message || 'Error al guardar');
      },
    });
  }

  protected openHeroImagePreview(url: string): void {
    this.heroImagePreview.set(url);
  }

  protected closeHeroImagePreview(): void {
    this.heroImagePreview.set(null);
  }

  protected getHeroCarouselIntervalInSeconds(): number {
    return (this.heroImagesCarouselForm().get('interval')?.value || 5000) / 1000;
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.saveSuccess.set(false);
  }
}
