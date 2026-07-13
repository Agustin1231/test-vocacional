import { Injectable } from '@angular/core';
import { Informe } from '../models/test.models';

const STORAGE_KEY = 'uniagraria_vocacional_informes';

/**
 * Persistencia local de los informes generados.
 *
 * Nota de arquitectura: esto es un respaldo del lado del cliente. En producción,
 * `RecordsService` (o el backend .NET) es la fuente de verdad; aquí solo se
 * guarda una copia para el panel de demostración del equipo sin conexión.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private available(): boolean {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  save(record: Informe): void {
    if (!this.available()) return;
    const all = this.list();
    all.unshift(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  list(): Informe[] {
    if (!this.available()) return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Informe[]) : [];
    } catch {
      return [];
    }
  }

  clear(): void {
    if (!this.available()) return;
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Genera un CSV con todos los informes para descargar. */
  toCsv(): string {
    const rows = this.list();
    const headers = [
      'ID', 'Fecha', 'Nombre', 'Apellidos', 'Documento', 'Número',
      'Celular', 'Correo', 'Colegio', 'Grado', 'Ciudad', 'Edad',
      'Resultado', 'Área',
    ];
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [
        r.id, r.fecha, r.registro.nombre, r.registro.apellidos,
        r.registro.tipoDocumento, r.registro.numeroDocumento, r.registro.celular,
        r.registro.correo, r.registro.colegio, r.registro.grado,
        r.registro.ciudad, r.registro.edad, r.carrera, r.area,
      ].map(escape).join(','),
    );
    return [headers.map(escape).join(','), ...lines].join('\r\n');
  }
}
