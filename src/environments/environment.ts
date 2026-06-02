/**
 * Configuración de entorno de desarrollo
 *
 * Para cambiar entre URLs, comenta/descomenta la línea correspondiente
 */
export const environment = {
  production: false,

  // === URL del Backend ===
  // Backend directo (standalone, sin gateway)
  apiUrl: 'http://localhost:3003/api',

  appName: 'TuBus Express',
  version: '1.0.0',

  // === Firebase Web SDK config (public by design) ===
  firebase: {
    apiKey: 'AIzaSyAdJBdLYX4mNYToBOrL9A06UZ25dvTnsDM',
    authDomain: 'tubusexpress.firebaseapp.com',
    projectId: 'tubusexpress',
    storageBucket: 'tubusexpress.firebasestorage.app',
    messagingSenderId: '1071922885496',
    appId: '1:1071922885496:web:d84becd2da3f1c21930e8d',
    // GA4 measurement id (G-XXXXXXXXXX). Required for Firebase Analytics on
    // WEB only. TODO(owner): paste it from Firebase Console → Project
    // Settings → Web app → SDK config after enabling Analytics. Until set,
    // web analytics stays disabled (graceful no-op); native is unaffected.
    measurementId: 'G-ZCFBGB0C3R',
  },

  // VAPID public key — Firebase Console → Cloud Messaging → Web Push certificates
  fcmVapidKey: 'BHfs0RFF_bqAjOu1qKSgTw5v38-9X9w4BS87vedogb4Uw5-UsIgMJEfM-_J7gVbChZ1bhr4zKPNNYhYYs5TTq0Q',
};
