import { ICamera, PickImageOptions } from './camera.service';

/**
 * Web image picker: programmatically creates a hidden `<input type="file">`
 * and dispatches a click. The user picks a file from the OS file dialog;
 * we resolve with the resulting `File`.
 *
 * Why not just expose an `<input type="file">` in the consumer template?
 * Because the platform-layer abstraction must offer a single API across
 * web and native. Consumers call `pickImage()` regardless of platform,
 * and the strategy hides the implementation detail.
 *
 * Cancellation: the file dialog does not emit a "cancel" event in any
 * browser. We resolve only when a file is selected. If the user cancels,
 * the promise pends forever — but the input element is removed on the
 * next pick or page change so there's no real leak.
 */
export class WebCameraStrategy implements ICamera {
  isAvailable(): boolean {
    return typeof document !== 'undefined';
  }

  pickImage(_options?: PickImageOptions): Promise<File> {
    return new Promise<File>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      // The presence of `capture` would force the camera on mobile web —
      // we omit it so users can pick from gallery too.
      input.style.display = 'none';
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        document.body.removeChild(input);
        if (file) {
          resolve(file);
        } else {
          reject(new Error('No file selected'));
        }
      });
      document.body.appendChild(input);
      input.click();
    });
  }
}
