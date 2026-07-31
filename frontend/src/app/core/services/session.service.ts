import { Injectable } from '@angular/core';

import {
  DecisionSesion,
  INACTIVIDAD_MAXIMA_MS,
  SesionGuardada,
  decidirSesion,
} from './session-ttl';

const SESSION_KEY = 'uniagraria_vocacional_sesion';

/**
 * Identificador de sesión del estudiante para el chat del asesor.
 *
 * El asesor IA guarda la memoria de la conversación por `sesion_id`, así que el
 * navegador necesita un id que sobreviva a las recargas de página. Se guarda en
 * localStorage; si no hay localStorage (SSR, modo privado restringido) se usa una
 * copia en memoria para esa pestaña.
 *
 * **La sesión caduca por inactividad** (`INACTIVIDAD_MAXIMA_MS`, 30 min). Antes era
 * perpetua, y eso tenía una consecuencia concreta: en una computadora compartida el
 * siguiente estudiante entraba al asesor y el agente arrastraba el hilo del
 * anterior, llamándolo por otro nombre o hablándole de una carrera que no era la
 * suya. La memoria del lado del servidor agrupa por este id y no tiene noción de
 * "sesión vencida" (`ia/app/memory.py`), así que la decisión de cuándo empieza una
 * conversación nueva se toma acá.
 *
 * El TTL no es suficiente por sí solo: cubre los hilos olvidados, no el relevo
 * inmediato en la sala de cómputo. Para eso `TestStateService.reset()` llama a
 * `renovar()`, que rota la sesión al rehacer el test.
 *
 * La decisión de caducidad vive en `session-ttl.ts` (lógica pura); acá queda solo
 * el acceso al almacenamiento.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private cache: SesionGuardada | null = null;

  /**
   * Id de sesión vigente. Cada llamada cuenta como actividad: corre la marca de
   * inactividad, así que una conversación en curso no se corta al medio.
   *
   * Lo llama el chat justo antes de enviar cada mensaje, que es exactamente el
   * momento en que "hubo actividad".
   */
  sesionId(): string {
    const decision = decidirSesion(
      this.cache ?? this.leer(),
      Date.now(),
      () => this.nuevoId(),
    );
    this.aplicar(decision);
    return decision.sesion.id;
  }

  /**
   * Fuerza una conversación nueva. Se llama cuando el estudiante arranca de cero
   * (ver `TestStateService.reset`): sin esto, rehacer el test dejaba vivo el hilo
   * con los datos del test anterior.
   */
  renovar(): string {
    const sesion: SesionGuardada = { id: this.nuevoId(), visto: Date.now() };
    this.cache = sesion;
    this.escribir(sesion);
    return sesion.id;
  }

  /**
   * Id para el probador del panel de administración, **separado del de los
   * estudiantes**: uno nuevo por cada vez que se abre la pantalla.
   *
   * Antes el panel usaba `sesionId()`, o sea que las pruebas del prompt caían en el
   * mismo hilo de memoria que las conversaciones de los estudiantes. Además, para
   * probar un prompt conviene arrancar sin historial: si no, lo que se está
   * midiendo es el prompt más lo que quedó de la prueba anterior.
   */
  private idPanel: string | null = null;

  sesionIdPanel(): string {
    if (!this.idPanel) this.idPanel = 'panel-' + this.nuevoId();
    return this.idPanel;
  }

  /** Persiste la decisión. Solo escribe cuando cambió algo que valga la pena. */
  private aplicar(decision: DecisionSesion): void {
    const anterior = this.cache;
    this.cache = decision.sesion;

    if (decision.renovada) {
      if (decision.motivo === 'inactividad') {
        console.info(
          `[sesion] conversación nueva: pasaron más de ${Math.round(
            INACTIVIDAD_MAXIMA_MS / 60000,
          )} min sin actividad.`,
        );
      }
      this.escribir(decision.sesion);
      return;
    }

    // Sesión vigente: se reescribe para correr la marca de actividad. Sin esto el
    // TTL pasaría a ser de duración total y cortaría conversaciones en curso.
    if (!anterior || anterior.visto !== decision.sesion.visto) {
      this.escribir(decision.sesion);
    }
  }

  private available(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  private leer(): SesionGuardada | null {
    if (!this.available()) return null;
    try {
      const crudo = localStorage.getItem(SESSION_KEY);
      if (!crudo) return null;

      // Formato anterior: el id en texto plano, sin marca de actividad. Se
      // DESCARTA y se empieza una conversación nueva.
      //
      // La alternativa era adoptarlo dándole `visto = ahora`, para que un
      // estudiante que estuviera conversando justo en el momento del despliegue no
      // perdiera el hilo. Pero esos ids son exactamente los perpetuos que este
      // cambio viene a eliminar: adoptarlos les daría un uso más a todos los
      // navegadores que ya tenían uno, que es el caso que queremos cortar. El costo
      // de descartarlo es que una conversación en curso arranca de nuevo una sola
      // vez; el de adoptarlo es seguir arrastrando hilos viejos.
      if (!crudo.startsWith('{')) return null;

      const dato = JSON.parse(crudo) as SesionGuardada;
      return dato && typeof dato === 'object' ? dato : null;
    } catch {
      // JSON corrupto o localStorage inaccesible: `decidirSesion` arranca de cero.
      return null;
    }
  }

  private escribir(sesion: SesionGuardada): void {
    if (!this.available()) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    } catch {
      // Sin persistencia: la sesión vive solo en memoria durante esta pestaña.
    }
  }

  /** UUID v4; con fallback para contextos sin `crypto.randomUUID` (http, navegadores viejos). */
  private nuevoId(): string {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch {
      // Cae al fallback de abajo.
    }
    return 'ses-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}
