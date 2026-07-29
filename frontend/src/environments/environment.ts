/**
 * Configuración de PRODUCCIÓN.
 *
 * Arquitectura vigente: el navegador habla ÚNICAMENTE con el backend .NET.
 * El servicio de IA queda detrás del backend, que hace de proxy y agrega la
 * API key compartida (`X-API-Key`). El frontend no guarda ni conoce claves.
 * Ambas URLs son relativas: nginx sirve el frontend y enruta `/api` al backend.
 */
export const environment = {
  production: true,

  /** API del backend .NET (informes, catálogos, login del panel). */
  apiUrl: '/api',

  /**
   * Chat del asesor académico, expuesto por el backend. Recibe
   * { texto, sesionId } y responde { reply }; el backend reenvía al servicio
   * de IA con { texto, sesion_id } y la API key.
   */
  aiChatUrl: '/api/ia/chat',

  /** Enlace oficial de inscripción de UNIAGRARIA. */
  inscripcionUrl: 'https://www.uniagraria.edu.co/inscripcion/',
};
