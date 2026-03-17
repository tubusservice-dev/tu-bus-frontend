/**
 * Configuración de entorno de producción
 *
 * Para cambiar entre URLs, comenta/descomenta la línea correspondiente
 */
export const environment = {
  production: true,

  // === URL del Backend ===
  // Producción (actualizar cuando se despliegue)
  apiUrl: 'https://tubus-express-backend.onrender.com/api',

  // Desarrollo local
  // apiUrl: 'http://localhost:3003/api',

  appName: 'TuBus Express',
  version: '1.0.0',
};
