/**
 * Configuración de PRODUCCIÓN.
 *
 * Arquitectura desacoplada (ver README del repo): la capa de IA vive detrás
 * de un servicio independiente. El frontend NUNCA llama directamente a un
 * proveedor de IA ni guarda API keys — solo apunta a los endpoints que
 * exponen el backend (.NET) y el servicio de IA (Agustín). Alternar entre
 * modelo local y en la nube se hace del lado del servicio, no aquí.
 */
export const environment = {
  production: true,

  /** API del backend .NET (registro de estudiantes, informes, etc.). */
  apiUrl: '/api',

  /**
   * Endpoint del servicio de IA (asesor académico). Recibe { mensajes, contexto }
   * y responde { reply }. El proveedor/modelo se decide en el servicio.
   */
  aiChatUrl: '/api/ia/chat',

  /** Enlace oficial de inscripción de UNIAGRARIA. */
  inscripcionUrl: 'https://www.uniagraria.edu.co/inscripcion/',
};
