import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type MechanicAvatarSize = 'sm' | 'md' | 'lg';

/**
 * Circular mechanic avatar. Renders the Cloudinary photo when available, with
 * automatic fallback to the mechanic's initial on a blue gradient when the
 * image is missing or fails to load.
 *
 * Intended for all surfaces that display mechanic identity — admin list,
 * detail, calendar, assignment modal, customer order detail, service tracking
 * and public progress page — so the UI stays consistent across contexts.
 */
@Component({
  selector: 'app-mechanic-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mechanic-avatar.component.html',
  styleUrl: './mechanic-avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MechanicAvatarComponent {
  @Input() avatar?: string | null;
  @Input() name = '';
  @Input() size: MechanicAvatarSize = 'md';
  @Input() ariaLabel = '';

  /** Flipped to true when the <img> element fails to load */
  protected readonly loadFailed = signal(false);

  protected readonly hasImage = computed(() => {
    if (this.loadFailed()) return false;
    const a = (this.avatar || '').trim();
    return a.length > 0;
  });

  protected get initial(): string {
    const n = (this.name || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  protected get effectiveAriaLabel(): string {
    return this.ariaLabel || `Foto de ${this.name || 'mecánico'}`;
  }

  protected onImgError(): void {
    this.loadFailed.set(true);
  }
}
