/**
 * Configuración de DESARROLLO.
 *
 * Apunta a los servicios locales que levantan tus compañeros de backend / IA.
 * Ajusta los puertos según corran .NET y el servicio de IA en tu máquina.
 */
export const environment = {
  production: false,

  /** Backend .NET local. */
  apiUrl: 'http://localhost:5000/api',

  /** Servicio de IA local (o proxy hacia la nube). */
  aiChatUrl: 'http://localhost:5000/api/ia/chat',

  inscripcionUrl: 'https://www.uniagraria.edu.co/inscripcion/',
};
