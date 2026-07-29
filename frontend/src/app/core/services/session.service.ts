import { Injectable } from '@angular/core';

const SESSION_KEY = 'uniagraria_vocacional_sesion';

/**
 * Identificador de sesión del estudiante.
 *
 * El asesor IA guarda la memoria de la conversación por `sesion_id`, así que el
 * navegador necesita un id estable que sobreviva a las recargas de página. Se
 * genera una sola vez y queda en localStorage; si no hay localStorage (SSR,
 * modo privado restringido) se usa una copia en memoria para esa pestaña.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private cache: string | null = null;

  /** Id de sesión del navegador (se crea la primera vez que se pide). */
  sesionId(): string {
    if (this.cache) return this.cache;
    const guardado = this.leer();
    this.cache = guardado ?? this.nuevoId();
    if (!guardado) this.escribir(this.cache);
    return this.cache;
  }

  private available(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  private leer(): string | null {
    if (!this.available()) return null;
    try {
      return localStorage.getItem(SESSION_KEY) || null;
    } catch {
      return null;
    }
  }

  private escribir(id: string): void {
    if (!this.available()) return;
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      // Sin persistencia: el id vive solo en memoria durante esta pestaña.
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
