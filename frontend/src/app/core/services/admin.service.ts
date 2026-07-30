import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Letter, Question } from '../models/test.models';
import { EMOJI, ORDER, PROFILES } from '../data/profiles.data';
import { QUESTIONS } from '../data/questions.data';
import { ResultadoListItem } from './records.service';

/** Una fila del ranking de áreas/carreras. */
export interface MetricaArea {
  letra: Letter | null;
  emoji: string;
  nombre: string;
  total: number;
  porcentaje: number;
}

/** Punto de la línea de tiempo (informes por día). */
export interface PuntoTiempo {
  fecha: string;
  etiqueta: string;
  total: number;
}

/** Resumen que alimenta el dashboard. */
export interface Metricas {
  totalInformes: number;
  areasDistintas: number;
  promedioPorcentaje: number;
  ultimaFecha: string | null;
  porArea: MetricaArea[];
  porPrograma: MetricaArea[];
  linea: PuntoTiempo[];
  sinPerfil: number;
}

/** Instrucciones del agente IA (system prompt). */
export interface InstruccionesAgente {
  clave: string;
  contenido: string;
  actualizado_en: string;
}

/** Estado de una operación contra el agente. */
export type EstadoAgente = 'ok' | 'no-disponible' | 'error';

export interface RespuestaAgente {
  estado: EstadoAgente;
  datos?: InstruccionesAgente;
  motivo?: string;
}

/** Clave donde se guardan las preguntas editadas desde el panel. */
const BANCO_KEY = 'uniagraria_banco_preguntas';

/**
 * Servicio del panel de administración.
 *
 * Tres responsabilidades:
 *
 * 1. **Métricas.** Se calculan en el cliente a partir de `GET /api/resultados`.
 *    El backend no expone endpoints de agregación, así que el panel resume lo
 *    que recibe. Sirve igual para la copia local del navegador.
 *
 * 2. **Banco de preguntas.** El cálculo del perfil vive en el frontend
 *    (ver docs/adr/0003), así que el banco editable es el de `core/data/`.
 *    Los cambios se guardan en `localStorage` y se pueden exportar a JSON para
 *    versionarlos en el repo. `GET /api/preguntas` no sirve como fuente porque
 *    no publica la letra de cada opción.
 *
 * 3. **Agente IA.** Las instrucciones viven en el servicio de IA
 *    (`GET/PUT /api/ia/instrucciones`), que exige `X-API-Key`. El navegador no
 *    puede llamarlo directo sin exponer esa clave (ver docs/adr/0002), así que
 *    este servicio apunta a un proxy en el backend que **todavía no existe**:
 *    devuelve `no-disponible` (404/501) para que la UI lo informe con claridad
 *    en vez de fingir que funciona.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);

  /** Banco de preguntas vigente (el editado, o el que trae el código). */
  readonly banco = signal<Question[]>(this.leerBanco());

  // ---------------------------------------------------------------- métricas

  /** Resume una lista de informes del backend. */
  metricasDesdeBackend(filas: ResultadoListItem[]): Metricas {
    const total = filas.length;
    const porPrograma = this.contar(
      filas.map((f) => f.programaAcademico),
      total,
    );
    const porArea = this.contar(
      filas.map((f) => f.perfilVocacional),
      total,
    );
    const conPorcentaje = filas.filter((f) => typeof f.porcentaje === 'number');
    const promedio = conPorcentaje.length
      ? conPorcentaje.reduce((a, f) => a + f.porcentaje, 0) / conPorcentaje.length
      : 0;

    return {
      totalInformes: total,
      areasDistintas: porArea.filter((a) => a.letra !== null || a.nombre !== 'Sin perfil').length,
      promedioPorcentaje: Math.round(promedio * 10) / 10,
      ultimaFecha: this.masReciente(filas.map((f) => f.fecha)),
      porArea,
      porPrograma,
      linea: this.linea(filas.map((f) => f.fecha)),
      sinPerfil: filas.filter((f) => !f.perfilVocacional).length,
    };
  }

  /** Resume la copia local (informes guardados en este navegador). */
  metricasDesdeLocal(
    filas: { letra: Letter; carrera: string; area: string; fecha: string }[],
  ): Metricas {
    const total = filas.length;
    const porArea = ORDER.map((L) => {
      const n = filas.filter((f) => f.letra === L).length;
      return {
        letra: L,
        emoji: EMOJI[L],
        nombre: PROFILES[L].area,
        total: n,
        porcentaje: total ? Math.round((n / total) * 1000) / 10 : 0,
      };
    })
      .filter((a) => a.total > 0)
      .sort((a, b) => b.total - a.total);

    return {
      totalInformes: total,
      areasDistintas: porArea.length,
      promedioPorcentaje: 0,
      ultimaFecha: this.masReciente(filas.map((f) => f.fecha)),
      porArea,
      porPrograma: this.contar(filas.map((f) => f.carrera), total),
      linea: this.linea(filas.map((f) => f.fecha)),
      sinPerfil: 0,
    };
  }

  /** Fecha más reciente sin asumir que la lista viene ordenada. */
  private masReciente(fechas: (string | null)[]): string | null {
    const validas = fechas.filter((f): f is string => !!f);
    if (!validas.length) return null;
    return validas.reduce((a, b) => (a > b ? a : b));
  }

  private contar(valores: (string | null)[], total: number): MetricaArea[] {
    const mapa = new Map<string, number>();
    for (const v of valores) {
      const clave = v?.trim() || 'Sin perfil';
      mapa.set(clave, (mapa.get(clave) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .map(([nombre, n]) => ({
        letra: this.letraDeArea(nombre),
        emoji: this.emojiDeNombre(nombre),
        nombre,
        total: n,
        porcentaje: total ? Math.round((n / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  /** Busca la letra cuyo área o carrera coincide con el nombre recibido. */
  private letraDeArea(nombre: string): Letter | null {
    const n = nombre.trim().toLowerCase();
    return (
      ORDER.find(
        (L) =>
          PROFILES[L].area.toLowerCase() === n ||
          PROFILES[L].carrera.toLowerCase() === n,
      ) ?? null
    );
  }

  private emojiDeNombre(nombre: string): string {
    const L = this.letraDeArea(nombre);
    return L ? EMOJI[L] : '•';
  }

  /** Agrupa por día (últimos 14 con datos). */
  private linea(fechas: string[]): PuntoTiempo[] {
    const mapa = new Map<string, number>();
    for (const f of fechas) {
      if (!f) continue;
      const dia = f.slice(0, 10);
      mapa.set(dia, (mapa.get(dia) ?? 0) + 1);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14)
      .map(([fecha, total]) => ({
        fecha,
        etiqueta: fecha.slice(5).replace('-', '/'),
        total,
      }));
  }

  // --------------------------------------------------------------- preguntas

  /** Guarda el banco editado en el navegador. */
  guardarBanco(preguntas: Question[]): void {
    this.banco.set(preguntas);
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(BANCO_KEY, JSON.stringify(preguntas));
    } catch {
      // sin persistencia; el cambio vive en memoria
    }
  }

  /** Vuelve al banco original del código. */
  restaurarBanco(): void {
    this.banco.set(structuredClone(QUESTIONS));
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(BANCO_KEY);
    } catch {
      // nada que limpiar
    }
  }

  /** ¿El banco actual difiere del que trae el código? */
  bancoEditado(): boolean {
    try {
      return typeof localStorage !== 'undefined' && !!localStorage.getItem(BANCO_KEY);
    } catch {
      return false;
    }
  }

  private leerBanco(): Question[] {
    try {
      if (typeof localStorage === 'undefined') return structuredClone(QUESTIONS);
      const raw = localStorage.getItem(BANCO_KEY);
      if (!raw) return structuredClone(QUESTIONS);
      const parsed = JSON.parse(raw) as Question[];
      return Array.isArray(parsed) && parsed.length ? parsed : structuredClone(QUESTIONS);
    } catch {
      return structuredClone(QUESTIONS);
    }
  }

  // ------------------------------------------------------------- agente IA

  /**
   * Lee las instrucciones del agente.
   *
   * Requiere que el backend exponga `GET /api/ia/instrucciones` como proxy
   * autenticado (hoy `IaController` solo tiene `POST chat`). Mientras no
   * exista, devuelve `no-disponible`.
   */
  leerInstrucciones(): Observable<RespuestaAgente> {
    return this.http
      .get<InstruccionesAgente>(`${environment.apiUrl}/ia/instrucciones`)
      .pipe(
        map((datos) => ({ estado: 'ok' as EstadoAgente, datos })),
        catchError((err) => of(this.fallo(err))),
      );
  }

  /** Guarda las instrucciones del agente (mismo pendiente que el `GET`). */
  guardarInstrucciones(contenido: string): Observable<RespuestaAgente> {
    return this.http
      .put<InstruccionesAgente>(`${environment.apiUrl}/ia/instrucciones`, { contenido })
      .pipe(
        map((datos) => ({ estado: 'ok' as EstadoAgente, datos })),
        catchError((err) => of(this.fallo(err))),
      );
  }

  private fallo(err: unknown): RespuestaAgente {
    const e = err as { status?: number; error?: { mensaje?: string } };
    // 404/405/501: el backend no expone (todavía) el proxy de instrucciones.
    if (e?.status === 404 || e?.status === 405 || e?.status === 501) {
      return {
        estado: 'no-disponible',
        motivo:
          'El backend todavía no expone /api/ia/instrucciones. Las instrucciones ' +
          'viven en el servicio de IA y requieren la clave compartida, que no puede ' +
          'estar en el navegador (ver docs/adr/0002).',
      };
    }
    if (e?.status === 401 || e?.status === 403) {
      return { estado: 'error', motivo: 'Tu sesión no tiene permisos para gestionar el agente.' };
    }
    return {
      estado: 'error',
      motivo: e?.error?.mensaje || 'No se pudo contactar el servicio. Revisa que el backend esté arriba.',
    };
  }
}
