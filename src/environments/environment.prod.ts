/**
 * Configuración de entorno de producción
 *
 * Para cambiar entre URLs, comenta/descomenta la línea correspondiente
 */
export const environment = {
  production: true,

  // === URL del Backend ===
  apiUrl: 'https://api.tubusexpress.com/api',

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
  },

  // VAPID public key — Firebase Console → Cloud Messaging → Web Push certificates
  fcmVapidKey: 'BHfs0RFF_bqAjOu1qKSgTw5v38-9X9w4BS87vedogb4Uw5-UsIgMJEfM-_J7gVbChZ1bhr4zKPNNYhYYs5TTq0Q',
};
