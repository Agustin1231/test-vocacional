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

  /** Sesión activa (null si no hay). */
  readonly sesion = signal<AdminSesion | null>(this.leerSesion());

  readonly autenticado = computed(() => this.sesion() !== null);
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
      if (raw) return JSON.parse(raw) as AdminSesion;
      // Compatibilidad: si alguien pegó el token a mano, se acepta como sesión mínima.
      const token = localStorage.getItem(TOKEN_KEY);
      return token ? { token, rol: ROL_ADMIN, nombre: 'Administrador' } : null;
    } catch {
      return null;
    }
  }
}
