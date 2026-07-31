/**
 * Decisión de caducidad de la sesión de chat, aislada de Angular a propósito.
 *
 * Está en su propio archivo y sin un solo import para que sea lógica pura y se
 * pueda ejercitar sin levantar el navegador: es una función de
 * (lo guardado, la hora actual) -> (id a usar, si se renovó). `SessionService` se
 * queda solo con el acceso a `localStorage`.
 */

/**
 * Inactividad tras la cual la conversación con el asesor se considera terminada.
 *
 * 30 minutos: bastante más que cualquier pausa natural del flujo (un estudiante
 * puede quedarse pensando una pregunta unos minutos) y bastante menos que el
 * tiempo en que una computadora compartida cambia de manos.
 *
 * Ojo con qué problema resuelve y cuál no: el TTL corta los hilos que quedaron
 * abiertos y olvidados, pero NO cubre el caso de la sala de cómputo cuando el
 * siguiente estudiante se sienta enseguida. Para eso está la rotación explícita
 * al rehacer el test (`TestStateService.reset`).
 */
export const INACTIVIDAD_MAXIMA_MS = 30 * 60 * 1000;

/** Lo que se persiste. `visto` es el momento del último mensaje, en epoch ms. */
export interface SesionGuardada {
  id: string;
  visto: number;
}

export interface DecisionSesion {
  /** Sesión a usar de acá en adelante. */
  sesion: SesionGuardada;
  /** true si hubo que empezar una conversación nueva (hay que persistirla). */
  renovada: boolean;
  /** Por qué se renovó. Sirve para el log y para explicar el comportamiento. */
  motivo: 'sin-sesion-previa' | 'inactividad' | 'dato-invalido' | null;
}

/**
 * Devuelve la sesión vigente, renovándola si expiró.
 *
 * `guardado` es lo que había en localStorage ya parseado (o null). `nuevoId` se
 * recibe como función para que la generación de ids quede afuera y la decisión
 * sea determinista y testeable.
 */
export function decidirSesion(
  guardado: SesionGuardada | null,
  ahora: number,
  nuevoId: () => string,
  ttlMs: number = INACTIVIDAD_MAXIMA_MS,
): DecisionSesion {
  if (!guardado) {
    return { sesion: { id: nuevoId(), visto: ahora }, renovada: true, motivo: 'sin-sesion-previa' };
  }

  // Un `visto` corrupto o del futuro no puede dejar una sesión inmortal: pasa si
  // alguien edita localStorage a mano, o si el reloj del equipo se corrigió hacia
  // atrás. Se trata como sesión nueva en lugar de confiar en el dato.
  const invalido =
    !guardado.id ||
    typeof guardado.visto !== 'number' ||
    !Number.isFinite(guardado.visto) ||
    guardado.visto > ahora;

  if (invalido) {
    return { sesion: { id: nuevoId(), visto: ahora }, renovada: true, motivo: 'dato-invalido' };
  }

  if (ahora - guardado.visto > ttlMs) {
    return { sesion: { id: nuevoId(), visto: ahora }, renovada: true, motivo: 'inactividad' };
  }

  // Vigente: se conserva el id y se corre la marca de actividad. Por eso el TTL es
  // de INACTIVIDAD y no de duración total: una conversación larga no se corta al
  // medio mientras el estudiante siga escribiendo.
  return { sesion: { id: guardado.id, visto: ahora }, renovada: false, motivo: null };
}
