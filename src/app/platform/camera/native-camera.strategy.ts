import { CameraSource, ICamera, PickImageOptions } from './camera.service';

/**
 * Native image picker via `@capacitor/camera`. Routes the user through
 * the OS's native UI (camera, photo library, or both via prompt).
 *
 * The plugin returns a base64 string which we convert into a `File` so
 * the existing `FormData`-based upload pipeline (used by `UploadService`)
 * works unchanged. The conversion is cheap (a few ms for typical photos).
 *
 * Permissions: `@capacitor/camera` handles the runtime permission prompt
 * automatically when invoked. AndroidManifest declarations for CAMERA and
 * READ_MEDIA_IMAGES must be present (added in P5.6).
 */
export class NativeCameraStrategy implements ICamera {
  isAvailable(): boolean {
    return true;
  }

  async pickImage(options: PickImageOptions = {}): Promise<File> {
    const { Camera, CameraResultType, CameraSource: PluginSource } = await import(
      '@capacitor/camera'
    );

    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Base64,
      source: this.mapSource(options.source ?? 'prompt', PluginSource),
      quality: options.quality ?? 90,
      width: options.maxWidth,
      height: options.maxHeight,
      // Disable editing UI by default — most apps don't need cropping.
      // Consumers can override per call once we expose more options.
      allowEditing: false,
    });

    if (!photo.base64String || !photo.format) {
      throw new Error('Camera plugin returned empty payload');
    }

    return this.base64ToFile(photo.base64String, photo.format);
  }

  /**
   * Translates our agnostic CameraSource enum to the plugin's internal
   * one. Decoupled so future plugin upgrades that rename their constants
   * only require updating this method, not every call site.
   */
  private mapSource(
    source: CameraSource,
    pluginEnum: typeof import('@capacitor/camera').CameraSource,
  ): import('@capacitor/camera').CameraSource {
    switch (source) {
      case 'camera':
        return pluginEnum.Camera;
      case 'gallery':
        return pluginEnum.Photos;
      case 'prompt':
      default:
        return pluginEnum.Prompt;
    }
  }

  /**
   * Converts a base64-encoded image into a `File` object the existing
   * upload pipeline can `formData.append(...)` directly.
   *
   * Uses `Blob` + `File` constructors which are present in every modern
   * Android WebView.
   */
  private base64ToFile(base64: string, format: string): File {
    const mime = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
    const byteCharacters = atob(base64);
    const byteArrays: Uint8Array[] = [];
    const sliceSize = 512;
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array<number>(slice.length);
      for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    const blob = new Blob(byteArrays, { type: mime });
    const filename = `image-${Date.now()}.${format}`;
    return new File([blob], filename, { type: mime, lastModified: Date.now() });
  }
}
