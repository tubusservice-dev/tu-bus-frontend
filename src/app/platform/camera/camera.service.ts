import { InjectionToken } from '@angular/core';

/**
 * Cross-platform image picker abstraction.
 *
 * Web: opens a synthetic `<input type="file">` programmatically and resolves
 * with the selected `File`. Mirrors the existing UX where every component
 * already uses an inline file input.
 *
 * Native (Android): uses `@capacitor/camera` plugin which presents the
 * OS-native picker prompt (camera vs gallery vs file system, depending on
 * `source`). Returns a `File` constructed from the captured base64 so the
 * downstream `FormData` upload code stays identical to the web path.
 *
 * Source modes mirror the plugin enum so consumers can express intent:
 *   - `'camera'`   — open camera directly (no chooser).
 *   - `'gallery'`  — open photo library directly.
 *   - `'prompt'`   — let the user choose between camera and gallery (default).
 */
export type CameraSource = 'camera' | 'gallery' | 'prompt';

export interface PickImageOptions {
  /** Where to source the image from. Defaults to `'prompt'`. */
  source?: CameraSource;
  /** Maximum width in pixels — Capacitor resizes before returning. */
  maxWidth?: number;
  /** Maximum height in pixels. */
  maxHeight?: number;
  /** JPEG/WEBP quality 0-100. Defaults to 90. */
  quality?: number;
}

export interface ICamera {
  /**
   * Returns true when the platform supports image picking. Always true
   * on native; on web depends on `<input type="file">` availability
   * (essentially every browser).
   */
  isAvailable(): boolean;

  /**
   * Opens the picker and resolves with the chosen image as a `File`,
   * ready to be appended to a `FormData` for backend upload.
   *
   * Rejects when the user cancels (callers should swallow silently).
   */
  pickImage(options?: PickImageOptions): Promise<File>;
}

export const CAMERA = new InjectionToken<ICamera>('PLATFORM_CAMERA');
