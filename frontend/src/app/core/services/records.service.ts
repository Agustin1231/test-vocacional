import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Counts, Letter, Registro } from '../models/test.models';

/** Una respuesta del quiz tal como la espera el backend. */
export interface RespuestaEnviada {
  preguntaId: number;
  letra: Letter;
  texto: string;
}

/** Resultado calculado en el frontend (el backend resuelve los ids del catálogo). */
export interface ResultadoEnviado {
  letra: Letter;
  perfil: string;
  carrera: string;
  area: string;
  contadores: Counts;
}

/** Cuerpo de POST /api/resultados (ver docs/api-contract.md). */
export interface ResultadoPayload {
  registro: Registro;
  respuestas: RespuestaEnviada[];
  resultado: ResultadoEnviado;
}

/** Respuesta de POST /api/resultados. */
export interface ResultadoCreado {
  id: string;
  fecha: string;
}

/** Fila del listado protegido GET /api/resultados. */
export interface ResultadoListItem {
  id: number;
  nombreEstudiante: string;
  correoEstudiante: string;
  puntaje: number;
  porcentaje: number;
  perfilVocacional: string | null;
  programaAcademico: string | null;
  fecha: string;
  /** Datos del formulario de registro. `celular` y `colegio` llegan como cadena
   * vacía si el estudiante los dejó en blanco; `ciudad` y `grado` llegan en
   * `null` si el texto enviado no coincidió con el catálogo. */
  celular: string | null;
  colegio: string | null;
  ciudad: string | null;
  grado: string | null;
}

/** Clave del JWT del panel en localStorage (la escribirá la pantalla de login cuando exista). */
export const TOKEN_KEY = 'uniagraria_admin_token';

/**
 * Cliente del backend .NET para los informes del test.
 *
 * Es la fuente de verdad de los datos; `StorageService` queda como respaldo
 * local del panel de demostración. Ningún método lanza: si el backend no está
 * disponible devuelven `null` para que la app siga funcionando sin conexión.
 */
@Injectable({ providedIn: 'root' })
export class RecordsService {
  constructor(private http: HttpClient) {}

  /** Envía el informe recién generado (endpoint público, el estudiante no está logueado). */
  enviarResultado(payload: ResultadoPayload): Observable<ResultadoCreado | null> {
    return this.http
      .post<ResultadoCreado>(`${environment.apiUrl}/resultados`, payload)
      .pipe(
        catchError((err) => {
          // Degradación silenciosa para el estudiante, pero el log distingue los
          // dos casos, que son muy distintos al depurar:
          //  - 4xx (400 validación, 409 conflicto de identidad): el backend
          //    RECHAZÓ el informe y no va a quedar guardado nunca.
          //  - 0 / 5xx: no hubo conexión o el backend falló; se puede reintentar.
          const estado = err?.status ?? 0;
          if (estado >= 400 && estado < 500) {
            console.error(
              `[records] el backend RECHAZÓ el informe (HTTP ${estado}): no quedó guardado.`,
              err?.error?.mensaje ?? err?.error ?? err?.message,
            );
          } else {
            console.warn(
              `[records] no se pudo enviar el informe al backend (HTTP ${estado}).`,
              err?.message ?? err,
            );
          }
          return of(null);
        }),
      );
  }

  /**
   * Listado para el panel del equipo. Devuelve `null` si no hay JWT guardado o
   * si la petición falla (token vencido, sin rol Administrador, backend caído),
   * para que el panel pueda caer al respaldo local.
   *
   * El endpoint está paginado (tope duro de 500 filas por página en el backend).
   *
   * PENDIENTE: no existe la pantalla de login, así que en la práctica no hay
   * token y esta llamada devuelve `null` sin emitir la petición.
   */
  listarResultados(pagina = 1, tamano = 200): Observable<ResultadoListItem[] | null> {
    const token = this.token();
    if (!token) return of(null);
    return this.http
      .get<ResultadoListItem[]>(`${environment.apiUrl}/resultados`, {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
        params: { pagina, tamano },
      })
      .pipe(
        catchError((err) => {
          console.warn('[records] no se pudo listar los informes del backend', err?.message ?? err);
          return of(null);
        }),
      );
  }

  /** JWT del panel, si alguien lo dejó en localStorage. */
  token(): string | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  }
}
