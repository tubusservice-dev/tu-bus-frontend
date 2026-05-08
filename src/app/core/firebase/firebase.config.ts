import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { environment } from '@env';

let appPromise: Promise<FirebaseApp> | null = null;

/**
 * Lazily loads the Firebase Web SDK and initializes the app.
 *
 * Why lazy: keeping `firebase/app` out of the initial bundle saves
 * ~50-100 kB at first paint. Push notifications are only requested
 * after a successful login (post-bootstrap), so paying for the SDK
 * up front is pure waste.
 *
 * Idempotent: subsequent calls reuse the same Promise → singleton
 * guarantee. Other Firebase consumers (future Analytics, etc.) MUST
 * await this Promise rather than re-initialize.
 */
export const getFirebaseApp = (): Promise<FirebaseApp> => {
  if (!appPromise) {
    appPromise = (async () => {
      const { initializeApp, getApp, getApps } = await import('firebase/app');
      if (getApps().length > 0) return getApp();
      return initializeApp(environment.firebase as FirebaseOptions);
    })();
  }
  return appPromise;
};
