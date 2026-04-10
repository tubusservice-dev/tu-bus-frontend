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
  clientUrl: 'http://localhost:4200',

  appName: 'TuBus Express',
  version: '1.0.0',
};
