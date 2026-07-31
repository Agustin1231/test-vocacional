import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TOKEN_KEY } from './records.service';

/** Respuesta de POST /api/auth/login (ver docs/api-contract.md). */
export interface LoginResponse {
  token: string;
  /** OJO: el contrato usa `rol`, no `role`. */
  rol: string;
  nombre: string;
}

/** Sesión del panel guardada en el navegador. */
export interface AdminSesion {
  token: string;
  rol: string;
  nombre: string;
}

/** Resultado de un intento de login: éxito o motivo del fallo. */
export type LoginResultado =
  | { ok: true; sesion: AdminSesion }
  | { ok: false; motivo: string };

const SESION_KEY = 'uniagraria_admin_sesion';

/**
 * Un token que vence dentro de este lapso ya se considera vencido: si no, la
 * petición sale del navegador con vida y llega al backend muerta.
 */
const MARGEN_EXPIRACION_MS = 30_000;

/** Rol que exige el backend en GET /api/resultados. */
export const ROL_ADMIN = 'Administrador';

/**
 * Autenticación del panel de administración.
 *
 * Habla con `POST /api/auth/login` y guarda el JWT en localStorage bajo la
 * misma clave que ya leía `RecordsService` (`TOKEN_KEY`), más los datos de
 * sesión para pintar el nombre y el rol.
 *
 * El backend exige el rol `Administrador` en los endpoints protegidos; un token
 * válido de otro rol devuelve 403. Por eso la sesión guarda el rol y el guard
 * lo verifica antes de dejar entrar al panel.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  /**
   * La última sesión se descartó por vencimiento, no por un logout normal.
   * El guard lo usa para explicar en el login por qué lo sacaron; si no, la
   * pantalla aparece pelada y parece que nunca inició sesión.
   *
   * Va declarado antes que `sesion` porque `leerSesion()` ya lo escribe.
   */
  readonly expiro = signal(false);

  /** Sesión activa (null si no hay). */
  readonly sesion = signal<AdminSesion | null>(this.leerSesion());

  readonly esAdmin = computed(() => this.sesion()?.rol === ROL_ADMIN);
  readonly nombre = computed(() => this.sesion()?.nombre ?? '');

  /**
   * Inicia sesión contra el backend.
   *
   * Distingue los tres fallos que el contrato define, porque se ven distintos
   * para quien usa el panel:
   *  - 400 `ValidationProblemDetails`: el correo no tiene formato o la clave
   *    tiene menos de 6 caracteres (la validación corre antes del método).
   *  - 401: credenciales incorrectas.
   *  - 429: demasiados intentos (rate limit de login, 10/min por IP).
   */
  login(correo: string, password: string): Observable<LoginResultado> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { correo, password })
      .pipe(
        map((res) => {
          const sesion: AdminSesion = {
            token: res.token,
            rol: res.rol,
            nombre: res.nombre,
          };
          return { ok: true, sesion } as LoginResultado;
        }),
        tap((r) => {
          if (r.ok) this.guardar(r.sesion);
        }),
        catchError((err) => of({ ok: false, motivo: this.motivo(err) } as LoginResultado)),
      );
  }

  /**
   * Hay sesión y su JWT todavía no expiró.
   *
   * No es un `computed`: el resultado depende del reloj, no de la señal, así
   * que cachearlo dejaría entrar con un token ya vencido mientras nadie
   * recargue la página.
   */
  autenticado(): boolean {
    const s = this.sesion();
    if (s && !this.vigente(s)) {
      this.logout();
      this.expiro.set(true);
      return false;
    }
    return s !== null;
  }

  /** Cierra la sesión y borra el token del navegador. */
  logout(): void {
    this.sesion.set(null);
    this.borrar();
  }

  /** JWT actual, o null. Lo usa el interceptor. */
  token(): string | null {
    return this.sesion()?.token ?? null;
  }

  // ---- interno ----

  /** `true` solo si hay sesión y su JWT todavía no expiró. */
  private vigente(s: AdminSesion | null): boolean {
    if (!s?.token) return false;
    const exp = this.expiracion(s.token);
    if (exp === null) return false;
    return exp - MARGEN_EXPIRACION_MS > Date.now();
  }

  /**
   * Milisegundos del `exp` del JWT, o `null` si el payload no se puede leer.
   * Un token ilegible se trata como vencido, no como eterno.
   */
  private expiracion(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      if (!payload) return null;
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(
        decodeURIComponent(
          atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
            .split('')
            .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
            .join(''),
        ),
      ) as { exp?: number };
      return typeof json.exp === 'number' ? json.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private motivo(err: unknown): string {
    const e = err as { status?: number; error?: { mensaje?: string; errors?: unknown } };
    switch (e?.status) {
      case 0:
        return 'No hay conexión con el servidor. Verifica que el backend esté disponible.';
      case 400:
        return 'Revisa los datos: el correo debe tener formato válido y la contraseña entre 6 y 128 caracteres.';
      case 401:
        return 'Correo o contraseña incorrectos.';
      case 403:
        return 'Esta cuenta no tiene permisos de administrador.';
      case 429:
        return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
      default:
        return e?.error?.mensaje || 'No se pudo iniciar sesión. Inténtalo más tarde.';
    }
  }

  private guardar(s: AdminSesion): void {
    this.sesion.set(s);
    this.expiro.set(false);
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(TOKEN_KEY, s.token);
      localStorage.setItem(SESION_KEY, JSON.stringify(s));
    } catch {
      // Sin persistencia: la sesión vive solo en memoria.
    }
  }

  private borrar(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(SESION_KEY);
    } catch {
      // nada que limpiar
    }
  }

  private leerSesion(): AdminSesion | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(SESION_KEY);
      const guardada = raw
        ? (JSON.parse(raw) as AdminSesion)
        : // Compatibilidad: si alguien pegó el token a mano, se acepta como sesión mínima.
          this.sesionDesdeToken(localStorage.getItem(TOKEN_KEY));
      if (!this.vigente(guardada)) {
        if (guardada) this.expiro.set(true);
        this.borrar();
        return null;
      }
      return guardada;
    } catch {
      return null;
    }
  }

  private sesionDesdeToken(token: string | null): AdminSesion | null {
    return token ? { token, rol: ROL_ADMIN, nombre: 'Administrador' } : null;
  }
}
