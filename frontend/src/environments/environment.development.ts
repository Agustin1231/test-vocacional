/**
 * Configuración de DESARROLLO.
 *
 * Todo pasa por el backend .NET local (puerto 5000), incluido el chat con la
 * IA: el backend hace de proxy hacia el servicio Python y agrega la API key.
 * No hace falta apuntar al servicio de IA desde el navegador.
 */
export const environment = {
  production: false,

  /** Backend .NET local. */
  apiUrl: 'http://localhost:5000/api',

  /** Chat del asesor, expuesto por el mismo backend. */
  aiChatUrl: 'http://localhost:5000/api/ia/chat',

  inscripcionUrl: 'https://www.uniagraria.edu.co/inscripcion/',
};
