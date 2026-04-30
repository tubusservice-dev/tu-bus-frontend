import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Brand-coherent palette derived from --accent-primary (rgb(0, 29, 86)).
 * Each user is hashed deterministically into one of these tones so the same
 * person always renders with the same color across the app, while the entire
 * palette stays within the corporate identity.
 */
const PALETTE: readonly string[] = [
  '#001d56',
  '#0a2d70',
  '#1a3d8a',
  '#1f4e9c',
  '#2960b8',
  '#3a72c4',
  '#4d85d0',
  '#5b97dc',
];

/** djb2 string hash — deterministic, fast, good distribution for short names. */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) + hash + input.charCodeAt(i);
  }
  return Math.abs(hash | 0);
}

/**
 * Resilient avatar with graceful fallback. Renders the provided `src` when
 * available; if the image fails to load (broken Google OAuth URL, expired
 * Cloudinary asset, network error) it falls back to an inline SVG showing the
 * user's initials over a brand-consistent background. No external service
 * required.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-avatar.component.html',
  styleUrl: './user-avatar.component.scss',
})
export class UserAvatarComponent {
  readonly name = input.required<string>();
  readonly src = input<string | null | undefined>(undefined);
  readonly size = input<number>(40);
  readonly ring = input<boolean>(false);

  protected readonly imageFailed = signal(false);

  constructor() {
    // When the consumer swaps the user (e.g. paginating in a list), reset the
    // failure flag so the new src gets a fresh attempt.
    effect(() => {
      this.src();
      this.imageFailed.set(false);
    });
  }

  protected readonly initials = computed(() => {
    const value = (this.name() ?? '').trim();
    if (!value) return '?';
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  });

  protected readonly bgColor = computed(() => {
    const key = (this.name() ?? '').trim() || 'anon';
    return PALETTE[hashString(key) % PALETTE.length];
  });

  protected readonly fontSize = computed(() => Math.round(this.size() * 0.4));

  protected readonly showImage = computed(() => {
    const src = this.src();
    return !!src && !this.imageFailed();
  });

  onImageError(): void {
    this.imageFailed.set(true);
  }
}
